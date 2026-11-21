package id.kebayaoma.print;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Handler;
import android.os.Looper;

import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Kirim byte mentah (ESC/POS nota / TSPL label) ke printer Bluetooth Classic lewat SPP.
 * - Satu antrean (thread tunggal): cetak otomatis + "Print Nota" tidak saling tabrak.
 * - Koneksi per printer dibiarkan terbuka IDLE_MS setelah job → cetak berikutnya tanpa sambung ulang
 *   (uji 2026-11-20: sambung pertama RPP02N ±5,8 dtk, koneksi hangat ±0,8 dtk).
 */
final class PrinterLink {
    interface Callback {
        void done(String error); // null = sukses
    }

    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final long IDLE_MS = 60_000;
    private static final int CHUNK = 2048;

    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final Map<String, BluetoothSocket> OPEN = new HashMap<>();
    private static final Map<String, Runnable> CLOSERS = new HashMap<>();

    static void send(String mac, byte[] data, Callback cb) {
        EXEC.execute(() -> {
            String err = null;
            try {
                write(mac, data);
            } catch (IOException first) {
                // koneksi lama mungkin sudah putus (printer dimatikan/tidur) → sambung ulang sekali
                closeNow(mac);
                try {
                    write(mac, data);
                } catch (IOException | SecurityException e) {
                    closeNow(mac);
                    err = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                }
            } catch (SecurityException e) {
                err = "Izin Bluetooth belum diberikan";
            }
            final String result = err;
            MAIN.post(() -> cb.done(result));
        });
    }

    @SuppressLint("MissingPermission")
    private static void write(String mac, byte[] data) throws IOException {
        BluetoothSocket s;
        synchronized (OPEN) {
            s = OPEN.get(mac);
        }
        if (s == null || !s.isConnected()) {
            BluetoothAdapter bt = BluetoothAdapter.getDefaultAdapter();
            if (bt == null || !bt.isEnabled()) throw new IOException("Bluetooth tablet mati");
            BluetoothDevice dev = bt.getRemoteDevice(mac);
            bt.cancelDiscovery();
            s = dev.createRfcommSocketToServiceRecord(SPP);
            s.connect();
            synchronized (OPEN) {
                OPEN.put(mac, s);
            }
        }
        OutputStream out = s.getOutputStream();
        for (int i = 0; i < data.length; i += CHUNK) {
            out.write(data, i, Math.min(CHUNK, data.length - i));
        }
        out.flush();
        scheduleClose(mac);
    }

    private static void scheduleClose(String mac) {
        synchronized (OPEN) {
            Runnable old = CLOSERS.remove(mac);
            if (old != null) MAIN.removeCallbacks(old);
            Runnable r = () -> EXEC.execute(() -> closeNow(mac));
            CLOSERS.put(mac, r);
            MAIN.postDelayed(r, IDLE_MS);
        }
    }

    private static void closeNow(String mac) {
        BluetoothSocket s;
        synchronized (OPEN) {
            s = OPEN.remove(mac);
            Runnable r = CLOSERS.remove(mac);
            if (r != null) MAIN.removeCallbacks(r);
        }
        if (s != null) {
            try {
                s.close();
            } catch (IOException ignored) {
            }
        }
    }

    private PrinterLink() {}
}
