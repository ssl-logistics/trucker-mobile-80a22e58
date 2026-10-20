package com.thetroob.mobile;

import android.os.Environment;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import java.io.File;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureCameraTempDirectory();
        lockTextZoom();
        
        // Initialize Firebase to prevent IllegalStateException
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        lockTextZoom();
    }

    // Ignore the phone's system font size so the layout never breaks
    private void lockTextZoom() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().getSettings().setTextZoom(100);
            }
        } catch (Exception ignored) {}
    }

    private void ensureCameraTempDirectory() {
        File picturesDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        if (picturesDir != null && !picturesDir.exists()) {
            picturesDir.mkdirs();
        }
    }
}
