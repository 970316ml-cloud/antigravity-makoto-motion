using System;
using System.Runtime.InteropServices;

internal static class WindowTransitions
{
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, uint attribute, ref int value, uint size);

    private static int Main(string[] args)
    {
        long handle;
        uint owner, actual;
        if (args.Length != 2 || !long.TryParse(args[0], out handle) || !uint.TryParse(args[1], out owner)) return 2;
        var hwnd = new IntPtr(handle);
        if (GetWindowThreadProcessId(hwnd, out actual) == 0 || actual != owner) return 3;
        const uint transitionsForceDisabled = 3;
        int enabled = 1;
        return DwmSetWindowAttribute(hwnd, transitionsForceDisabled, ref enabled, sizeof(int));
    }
}
