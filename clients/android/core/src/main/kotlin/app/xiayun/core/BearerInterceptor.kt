package app.xiayun.core

import okhttp3.Interceptor
import okhttp3.Response

class BearerInterceptor(
    private val token: () -> String?,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val value = token()?.takeIf { it.isNotBlank() } ?: return chain.proceed(chain.request())
        val request = chain.request().newBuilder()
            .header("Authorization", "Bearer $value")
            .build()
        return chain.proceed(request)
    }
}
