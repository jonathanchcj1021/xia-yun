package app.xiayun.android

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import app.xiayun.android.passkey.PasskeySigner
import app.xiayun.android.session.BiometricVault
import app.xiayun.android.ui.XiaYunApp
import app.xiayun.android.ui.XiaYunTheme

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as XiaYunApplication).container
        val vault = BiometricVault(this)
        val passkey = PasskeySigner(this) { container.api() }
        setContent {
            XiaYunTheme {
                XiaYunApp(container = container, vault = vault, passkey = passkey)
            }
        }
    }
}
