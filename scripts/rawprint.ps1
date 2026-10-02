param(
  [string]$Printer = 'Xprinter XP-D4601B',
  [string]$File
)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrn {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)] public static extern bool StartDocPrinter(IntPtr h, int l, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
  public static string Send(string printer, byte[] data) {
    IntPtr h; if (!OpenPrinter(printer, out h, IntPtr.Zero)) return "OpenPrinter fail " + Marshal.GetLastWin32Error();
    var di = new DOCINFOA { pDocName = "POS TSPL", pDataType = "RAW" };
    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return "StartDoc fail " + Marshal.GetLastWin32Error(); }
    StartPagePrinter(h); int w;
    bool ok = WritePrinter(h, data, data.Length, out w);
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return ok ? ("OK bytes=" + w) : ("Write fail " + Marshal.GetLastWin32Error());
  }
}
'@
$bytes = [System.IO.File]::ReadAllBytes($File)
[RawPrn]::Send($Printer, $bytes)
