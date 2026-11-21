package id.kebayaoma.print;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Pilih printer nota & label dari perangkat Bluetooth yang sudah dipasangkan, lalu tes. */
public class SettingsActivity extends Activity {
    private static final int REQ_BT = 1;

    private LinearLayout root;
    private TextView status;
    private final List<String> macs = new ArrayList<>();
    private final List<String> names = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int p = dp(20);
        root.setPadding(p, p, p, p);
        scroll.addView(root);
        setContentView(scroll);
        build();
    }

    private void build() {
        root.removeAllViews();
        title("Kebaya Oma Print");
        text("Web app POS mengirim nota & label ke sini; app ini mencetak langsung lewat Bluetooth (tanpa RawBT). "
                + "Aktifkan juga \"Cetak via Kebaya Oma Print\" di sidebar POS.");

        if (!hasBtPermission()) {
            text("Izin Bluetooth belum diberikan.");
            button("Izinkan Bluetooth", v -> requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, REQ_BT));
            return;
        }
        loadBonded();
        if (macs.isEmpty()) {
            text("Belum ada printer Bluetooth yang dipasangkan. Pasangkan dulu di Setelan Android → Bluetooth.");
            return;
        }
        picker("Printer NOTA (RPP02N)", Prefs.NOTA);
        picker("Printer LABEL (XP-D4601B)", Prefs.LABEL);
        button("Tes nota (cetak 1 baris)", v -> test(Prefs.NOTA,
                "\u001b@TES Kebaya Oma Print - nota\n\n\n".getBytes(StandardCharsets.US_ASCII)));
        button("Tes label (bunyi bip, tanpa kertas)", v -> test(Prefs.LABEL,
                "SOUND 5,300\r\n".getBytes(StandardCharsets.US_ASCII)));
        status = text("");
    }

    @SuppressLint("MissingPermission")
    private void loadBonded() {
        macs.clear();
        names.clear();
        BluetoothAdapter bt = BluetoothAdapter.getDefaultAdapter();
        if (bt == null) return;
        for (BluetoothDevice d : bt.getBondedDevices()) {
            macs.add(d.getAddress());
            names.add((d.getName() == null ? "?" : d.getName()) + "  (" + d.getAddress() + ")");
        }
    }

    private void picker(String label, String target) {
        text(label);
        Spinner sp = new Spinner(this);
        sp.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names));
        int cur = macs.indexOf(Prefs.mac(this, target));
        if (cur >= 0) sp.setSelection(cur);
        sp.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                Prefs.setMac(SettingsActivity.this, target, macs.get(position));
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });
        root.addView(sp);
    }

    private void test(String target, byte[] data) {
        if (status != null) status.setText("Mengirim tes " + target + "…");
        PrinterLink.send(Prefs.mac(this, target), data, error -> {
            if (status != null) status.setText(error == null ? "Tes " + target + " terkirim ✓" : "Gagal: " + error);
        });
    }

    private boolean hasBtPermission() {
        return Build.VERSION.SDK_INT < 31
                || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        build();
    }

    private void title(String s) {
        TextView t = text(s);
        t.setTextSize(22);
    }

    private TextView text(String s) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(16);
        t.setPadding(0, dp(12), 0, dp(4));
        root.addView(t, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return t;
    }

    private void button(String s, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(s);
        b.setOnClickListener(l);
        root.addView(b);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
