using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

public static class RibbonShellLink
{
    private static readonly Guid ShellLinkClass = new Guid("00021401-0000-0000-C000-000000000046");
    private static readonly PropertyKey AppId = new PropertyKey
    {
        Format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
        Id = 5
    };

    [StructLayout(LayoutKind.Sequential)]
    private struct PropertyKey
    {
        public Guid Format;
        public uint Id;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PropVariant
    {
        public ushort Type, Reserved1, Reserved2, Reserved3;
        public IntPtr Value, Extra;
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        void GetCount(out uint count);
        void GetAt(uint index, out PropertyKey key);
        void GetValue(ref PropertyKey key, out PropVariant value);
        void SetValue(ref PropertyKey key, ref PropVariant value);
        void Commit();
    }

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PropVariant variant);

    public static void WriteId(string path, string id)
    {
        object link = Activator.CreateInstance(Type.GetTypeFromCLSID(ShellLinkClass));
        try
        {
            var storage = (IPersistFile)link;
            var properties = (IPropertyStore)link;
            storage.Load(path, 2);
            var key = AppId;
            var value = new PropVariant { Type = 31, Value = Marshal.StringToCoTaskMemUni(id) };
            try
            {
                properties.SetValue(ref key, ref value);
                properties.Commit();
                storage.Save(path, true);
            }
            finally { PropVariantClear(ref value); }
        }
        finally { Marshal.FinalReleaseComObject(link); }
    }

    public static string ReadId(string path)
    {
        object link = Activator.CreateInstance(Type.GetTypeFromCLSID(ShellLinkClass));
        try
        {
            ((IPersistFile)link).Load(path, 0);
            var key = AppId;
            PropVariant value;
            ((IPropertyStore)link).GetValue(ref key, out value);
            try { return value.Type == 31 ? Marshal.PtrToStringUni(value.Value) : null; }
            finally { PropVariantClear(ref value); }
        }
        finally { Marshal.FinalReleaseComObject(link); }
    }
}
