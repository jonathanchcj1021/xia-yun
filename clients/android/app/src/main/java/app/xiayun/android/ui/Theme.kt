package app.xiayun.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Cinnabar = Color(0xFF8C3A2A)
private val CinnabarDark = Color(0xFFE7B2A4)
private val Paper = Color(0xFFF6F1E6)
private val Card = Color(0xFFFFFCF7)
private val Ink = Color(0xFF3A2C24)
private val Muted = Color(0xFF7A685C)
private val Line = Color(0xFFE4D8C8)
private val Danger = Color(0xFF9C2F2F)

private val LightColors = lightColorScheme(
    primary = Cinnabar,
    onPrimary = Color(0xFFFFF8F2),
    primaryContainer = Color(0xFFF3D7CF),
    onPrimaryContainer = Color(0xFF3F140C),
    secondary = Color(0xFFEFE4D4),
    onSecondary = Ink,
    background = Paper,
    onBackground = Ink,
    surface = Card,
    onSurface = Ink,
    surfaceVariant = Color(0xFFF3EADF),
    onSurfaceVariant = Muted,
    outline = Line,
    error = Danger,
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = CinnabarDark,
    onPrimary = Color(0xFF3F140C),
    primaryContainer = Color(0xFF6A2C20),
    onPrimaryContainer = Color(0xFFFFE8E1),
    secondary = Color(0xFF4A3D34),
    onSecondary = Color(0xFFF6F1E6),
    background = Color(0xFF1C1612),
    onBackground = Color(0xFFF6F1E6),
    surface = Color(0xFF2A221C),
    onSurface = Color(0xFFF6F1E6),
    surfaceVariant = Color(0xFF3A3028),
    onSurfaceVariant = Color(0xFFD9CBBC),
    outline = Color(0xFF5C4E44),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
)

@Composable
fun XiaYunTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
