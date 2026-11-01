package com.zachery.customcalendar.Alarms;

import java.io.IOException;

public final class Toasts {

    private Toasts() {}

    /*
    Windows won't show a toast with our name and icon unless the app has an
    AppUserModelID registered under HKCU first, so write it here instead of
    making the installer do it
    */
    public static void register(String aumid, String displayName, String iconPath) {
        try {
            String regPath = "HKCU\\Software\\Classes\\AppUserModelId\\" + aumid;

            Runtime.getRuntime().exec(new String[]{
                "reg", "add", regPath, "/v", "DisplayName", "/t", "REG_SZ", "/d", displayName, "/f"
            }).waitFor();

            Runtime.getRuntime().exec(new String[]{
                "reg", "add", regPath, "/v", "IconUri", "/t", "REG_SZ", "/d", iconPath, "/f"
            }).waitFor();

            System.out.println("App registered for toasts: " + aumid);
        }
        // exec().waitFor() only throws these two
        catch (IOException | InterruptedException e) {
            System.err.println("couldn't register the app. windows just doesn't get me. " + e.getMessage());
        }
    }
}
