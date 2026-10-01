package app.xiayun.android

import android.content.Context
import android.os.Build
import app.xiayun.android.session.AndroidSessionStore
import app.xiayun.core.AuthSession
import app.xiayun.core.BaseUrls
import app.xiayun.core.DeviceHints
import app.xiayun.core.SessionGate
import app.xiayun.core.XiaYunApi
import app.xiayun.core.isEmulator
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow

class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    private val settings = appContext.getSharedPreferences("xiayun_settings", Context.MODE_PRIVATE)
    val sessionStore = AndroidSessionStore(appContext)
    val gate = SessionGate(sessionStore)
    val session = MutableStateFlow<AuthSession?>(null)
    val unauthorized = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    fun baseUrl(): String {
        val saved = settings.getString(KEY_URL, null)
        if (!saved.isNullOrBlank()) return saved
        return BaseUrls.defaultFor(isEmulator(deviceHints()))
    }

    fun setBaseUrl(url: String) {
        settings.edit().putString(KEY_URL, url).apply()
    }

    fun api(): XiaYunApi = XiaYunApi(baseUrlProvider = ::baseUrl)

    fun notifyUnauthorized() {
        unauthorized.tryEmit(Unit)
    }

    private fun deviceHints() = DeviceHints(
        fingerprint = Build.FINGERPRINT.orEmpty(),
        model = Build.MODEL.orEmpty(),
        hardware = Build.HARDWARE.orEmpty(),
        product = Build.PRODUCT.orEmpty(),
        manufacturer = Build.MANUFACTURER.orEmpty(),
        brand = Build.BRAND.orEmpty(),
        device = Build.DEVICE.orEmpty(),
    )

    companion object {
        private const val KEY_URL = "base_url"
    }
}
