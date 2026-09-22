package com.videoapna.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int CAMERA_MIC_REQUEST = 2001;

    private PermissionRequest pendingPermissionRequest;

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        /*
         * App पहली बार खुलते ही Camera + Microphone
         * दोनों permissions एक साथ मांगें।
         *
         * Android permission को एक बार Allow करने के बाद
         * अगली बार popup नहीं दिखाएगा, जब तक user Settings
         * से permission वापस बंद न करे।
         */
        requestCameraMicAtStartup();
    }

    private void requestCameraMicAtStartup() {

        boolean cameraGranted =
                ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED;

        boolean micGranted =
                ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED;

        if (cameraGranted && micGranted) {
            return;
        }

        ActivityCompat.requestPermissions(
                this,
                new String[]{
                        Manifest.permission.CAMERA,
                        Manifest.permission.RECORD_AUDIO
                },
                CAMERA_MIC_REQUEST
        );
    }

    @Override
    public void onStart() {
        super.onStart();

        if (getBridge() != null &&
                getBridge().getWebView() != null) {

            getBridge().getWebView().setWebChromeClient(
                new android.webkit.WebChromeClient() {

                    @Override
                    public void onPermissionRequest(
                            final PermissionRequest request
                    ) {
                        runOnUiThread(() -> {

                            boolean cameraGranted =
                                    ContextCompat.checkSelfPermission(
                                            MainActivity.this,
                                            Manifest.permission.CAMERA
                                    ) == PackageManager.PERMISSION_GRANTED;

                            boolean micGranted =
                                    ContextCompat.checkSelfPermission(
                                            MainActivity.this,
                                            Manifest.permission.RECORD_AUDIO
                                    ) == PackageManager.PERMISSION_GRANTED;

                            /*
                             * Android permissions पहले से Allow हैं।
                             * WebView को Camera/Mic resources सीधे दें।
                             */
                            if (cameraGranted && micGranted) {
                                request.grant(request.getResources());
                                return;
                            }

                            /*
                             * अगर किसी कारण से permission अभी नहीं मिली,
                             * तो वही दोनों permissions फिर request करें।
                             */
                            pendingPermissionRequest = request;

                            ActivityCompat.requestPermissions(
                                    MainActivity.this,
                                    new String[]{
                                            Manifest.permission.CAMERA,
                                            Manifest.permission.RECORD_AUDIO
                                    },
                                    CAMERA_MIC_REQUEST
                            );
                        });
                    }
                }
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(
                requestCode,
                permissions,
                grantResults
        );

        if (requestCode != CAMERA_MIC_REQUEST) {
            return;
        }

        PermissionRequest request = pendingPermissionRequest;
        pendingPermissionRequest = null;

        /*
         * Startup permission request था तो कोई pending
         * WebView request नहीं होगी। इसलिए यहीं समाप्त।
         */
        if (request == null) {
            return;
        }

        boolean cameraGranted =
                ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED;

        boolean micGranted =
                ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED;

        if (cameraGranted && micGranted) {
            request.grant(request.getResources());
        } else {
            request.deny();
        }
    }
}
