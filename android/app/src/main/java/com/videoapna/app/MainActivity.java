package com.videoapna.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int CAMERA_MIC_REQUEST = 2001;
    private static final int FILE_CHOOSER_REQUEST = 3001;

    private PermissionRequest pendingPermissionRequest;
    private ValueCallback<Uri[]> pendingFileCallback;

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestCameraMicAtStartup();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupWebViewFilePicker();
    }

    private void setupWebViewFilePicker() {

        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();

        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {

                if (pendingFileCallback != null) {
                    pendingFileCallback.onReceiveValue(null);
                }

                pendingFileCallback = filePathCallback;

                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("video/*");
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);

                    startActivityForResult(
                            Intent.createChooser(intent, "वीडियो चुनें"),
                            FILE_CHOOSER_REQUEST
                    );

                    return true;

                } catch (Exception e) {

                    try {
                        Intent fallback = new Intent(Intent.ACTION_GET_CONTENT);
                        fallback.addCategory(Intent.CATEGORY_OPENABLE);
                        fallback.setType("video/*");
                        fallback.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);

                        startActivityForResult(
                                Intent.createChooser(fallback, "वीडियो चुनें"),
                                FILE_CHOOSER_REQUEST
                        );

                        return true;

                    } catch (Exception ignored) {

                        if (pendingFileCallback != null) {
                            pendingFileCallback.onReceiveValue(null);
                            pendingFileCallback = null;
                        }

                        return false;
                    }
                }
            }

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

                    if (cameraGranted && micGranted) {
                        request.grant(request.getResources());
                        return;
                    }

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
        });
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            @Nullable Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != FILE_CHOOSER_REQUEST) {
            return;
        }

        if (pendingFileCallback == null) {
            return;
        }

        Uri[] results = null;

        if (resultCode == Activity.RESULT_OK && data != null) {

            if (data.getClipData() != null) {

                int count = data.getClipData().getItemCount();

                if (count > 0) {
                    results = new Uri[]{
                            data.getClipData().getItemAt(0).getUri()
                    };
                }

            } else if (data.getData() != null) {

                results = new Uri[]{
                        data.getData()
                };
            }
        }

        pendingFileCallback.onReceiveValue(results);
        pendingFileCallback = null;
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
