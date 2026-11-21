package id.kebayaoma.print;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.widget.Toast;

/**
 * Dipanggil web app POS (Chrome) lewat intent:
 *   kopos-print:nota;base64,&lt;ESC/POS&gt;   → printer NOTA
 *   kopos-print:label;base64,&lt;TSPL&gt;     → printer LABEL
 *   kopos-print:settings                  → layar pengaturan
 * Layar transparan; selesai mengirim → tutup sendiri (halaman POS tetap di depan).
 */
public class PrintActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri uri = getIntent() == null ? null : getIntent().getData();
        String ssp = uri == null ? null : uri.getEncodedSchemeSpecificPart();
        if (ssp == null || ssp.startsWith("settings")) {
            startActivity(new Intent(this, SettingsActivity.class));
            finish();
            return;
        }

        int semi = ssp.indexOf(';');
        String target = semi > 0 ? ssp.substring(0, semi) : "";
        String rest = semi > 0 ? ssp.substring(semi + 1) : "";
        if (!Prefs.NOTA.equals(target) && !Prefs.LABEL.equals(target) || !rest.startsWith("base64,")) {
            toast("Format cetak tidak dikenal");
            finish();
            return;
        }

        byte[] data;
        try {
            data = Base64.decode(Uri.decode(rest.substring(7)), Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            toast("Data cetak rusak");
            finish();
            return;
        }

        if (Build.VERSION.SDK_INT >= 31
                && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            toast("Izinkan Bluetooth dulu di app Kebaya Oma Print");
            startActivity(new Intent(this, SettingsActivity.class));
            finish();
            return;
        }

        final String what = Prefs.LABEL.equals(target) ? "label" : "nota";
        PrinterLink.send(Prefs.mac(this, target), data, error -> {
            if (error != null) toast("Gagal cetak " + what + ": " + error);
            finish();
        });
    }

    private void toast(String msg) {
        Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_LONG).show();
    }
}
