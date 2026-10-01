package app.xiayun.android.ui

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Status bar, navigation bar, and the IME. Use this on full-screen columns.
 */
@Composable
fun Modifier.safeScreenPadding(): Modifier = windowInsetsPadding(
    WindowInsets.systemBars.union(WindowInsets.navigationBars).union(WindowInsets.ime),
)

/**
 * Lifts bottom actions by the full navigation-bar inset (3-button or gesture)
 * and by the keyboard, not by a fixed few dp.
 */
@Composable
fun Modifier.aboveSystemBars(): Modifier = windowInsetsPadding(
    WindowInsets.systemBars
        .union(WindowInsets.navigationBars)
        .union(WindowInsets.ime)
        .only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom),
)
