package app.xiayun.android.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

@Composable
fun Mark(
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary,
) {
    Canvas(modifier.size(28.dp)) {
        val stroke = 2.dp.toPx()
        val left = 4f / 32f * size.width
        val top = 7f / 32f * size.height
        val width = 24f / 32f * size.width
        val height = 18f / 32f * size.height
        drawRoundRect(
            color = color,
            topLeft = Offset(left, top),
            size = Size(width, height),
            cornerRadius = CornerRadius(3f / 32f * size.minDimension),
            style = Stroke(width = stroke),
        )
        val lid = 13f / 32f * size.height
        drawLine(color, Offset(left, lid), Offset(left + width, lid), strokeWidth = stroke)
        val latch = 10f / 32f * size.width
        drawLine(color, Offset(latch, top), Offset(latch, lid), strokeWidth = stroke)
    }
}
