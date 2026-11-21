package id.kebayaoma.print;

import android.content.Context;
import android.content.SharedPreferences;

/** Printer per target (alamat MAC Bluetooth). Default = printer tablet kasir Kebaya Oma MJ (2026-11-20). */
final class Prefs {
    static final String NOTA = "nota";
    static final String LABEL = "label";

    /** Rongta RPP02N (nota, ESC/POS 80mm) */
    static final String DEFAULT_NOTA_MAC = "86:67:7A:E1:3B:FC";
    /** Xprinter XP-D4601B (label, TSPL) */
    static final String DEFAULT_LABEL_MAC = "28:D4:1E:51:54:19";

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences("printers", Context.MODE_PRIVATE);
    }

    static String mac(Context c, String target) {
        String def = LABEL.equals(target) ? DEFAULT_LABEL_MAC : DEFAULT_NOTA_MAC;
        return sp(c).getString(target, def);
    }

    static void setMac(Context c, String target, String mac) {
        sp(c).edit().putString(target, mac).apply();
    }

    private Prefs() {}
}
