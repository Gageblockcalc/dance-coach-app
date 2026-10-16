package com.tekjeep.dancecoach;

import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Forwards game-controller keys/axes to JS (window.dcNativePad) so pads the WebView's Gamepad API
 * misses still work. The WebView still receives every event (super is always called), and the
 * system Back button from the phone/nav bar is never touched — only a controller's B/Back is
 * kept from closing the app and routed to the in-app "back" instead.
 */
public class MainActivity extends BridgeActivity {
    private static boolean fromPad(int source) {
        return (source & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
            || (source & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    }

    private String insetJs = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        try {
            WebView w = getBridge().getWebView();
            ViewCompat.setOnApplyWindowInsetsListener(w, (v, wi) -> {
                Insets i = wi.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                float d = getResources().getDisplayMetrics().density;
                insetJs = String.format(java.util.Locale.US,
                    "(function(){var s=document.documentElement.style;s.setProperty('--sat','%.1fpx');s.setProperty('--sab','%.1fpx');s.setProperty('--sal','%.1fpx');s.setProperty('--sar','%.1fpx')})()",
                    i.top / d, i.bottom / d, i.left / d, i.right / d);
                js(insetJs);
                final String ij = insetJs;
                v.postDelayed(() -> js(ij), 1500);
                v.postDelayed(() -> js(ij), 4000);
                return wi;
            });
            ViewCompat.requestApplyInsets(w);
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        if (insetJs != null) js(insetJs);
    }

    private void js(String code) {
        try {
            if (getBridge() == null) return;
            WebView w = getBridge().getWebView();
            if (w != null) w.evaluateJavascript(code, null);
        } catch (Exception ignored) {}
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode();
        boolean pad = fromPad(e.getSource()) || KeyEvent.isGamepadButton(code);
        if (!pad || e.getRepeatCount() > 0) return pad ? true : super.dispatchKeyEvent(e);
        boolean down = e.getAction() == KeyEvent.ACTION_DOWN;
        js("window.dcNativePad&&window.dcNativePad('key'," + code + "," + (down ? 1 : 0) + ")");
        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_BUTTON_B) {
            // let the WebView's Gamepad API see B, but swallow the Back fallback so the app doesn't exit
            if (code == KeyEvent.KEYCODE_BUTTON_B) super.dispatchKeyEvent(e);
            else if (down) js("window.dcBack&&window.dcBack()");
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if (fromPad(e.getSource()) && e.getAction() == MotionEvent.ACTION_MOVE) {
            js(String.format(java.util.Locale.US, "window.dcNativePad&&window.dcNativePad('axes',[%.2f,%.2f,%.2f,%.2f])",
                e.getAxisValue(MotionEvent.AXIS_X), e.getAxisValue(MotionEvent.AXIS_Y),
                e.getAxisValue(MotionEvent.AXIS_HAT_X), e.getAxisValue(MotionEvent.AXIS_HAT_Y)));
        }
        return super.dispatchGenericMotionEvent(e);
    }
}
