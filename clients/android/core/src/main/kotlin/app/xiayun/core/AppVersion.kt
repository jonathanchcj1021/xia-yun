package app.xiayun.core

private val sha = Regex("^[0-9a-f]{7,40}$")

/** First 7 hex chars of the server deploy commit. Anything else is dev. */
fun shortAppVersion(raw: String?): String {
    val value = raw?.trim()?.lowercase().orEmpty()
    if (!sha.matches(value)) return "dev"
    return value.take(7)
}
