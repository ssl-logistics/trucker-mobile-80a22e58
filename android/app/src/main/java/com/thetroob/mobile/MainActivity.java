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
        
        // Initialize Firebase to prevent IllegalStateException
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this);
        }
    }

    private void ensureCameraTempDirectory() {
        File picturesDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        if (picturesDir != null && !picturesDir.exists()) {
            picturesDir.mkdirs();
        }
    }
}
