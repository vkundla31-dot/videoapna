package com.videoapna.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int MIC_PERMISSION_REQUEST = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
        ) != PackageManager.PERMISSION_GRANTED) {

            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    MIC_PERMISSION_REQUEST
            );
        }

        if (bridge != null && bridge.getWebView() != null) {

            WebView webView = bridge.getWebView();

            WebSettings settings = webView.getSettings();

            settings.setMediaPlaybackRequiresUserGesture(false);

            webView.setWebChromeClient(
                    new android.webkit.WebChromeClient() {

                        @Override
                        public void onPermissionRequest(
                                final PermissionRequest request
                        ) {

                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {

                                    String[] resources =
                                            request.getResources();

                                    for (String resource : resources) {

                                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {

                                            if (ContextCompat.checkSelfPermission(
                                                    MainActivity.this,
                                                    Manifest.permission.RECORD_AUDIO
                                            ) == PackageManager.PERMISSION_GRANTED) {

                                                request.grant(
                                                        new String[]{
                                                                PermissionRequest.RESOURCE_AUDIO_CAPTURE
                                                        }
                                                );

                                            } else {

                                                request.deny();
                                            }

                                            return;
                                        }
                                    }

                                    request.deny();
                                }
                            });
                        }
                    }
            );
        }
    }
}
