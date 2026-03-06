package com.ecosquad.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.ecosquad.R
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.MissionStatus
import com.ecosquad.domain.model.MissionType

@Composable
fun MissionCard(
    mission: Mission,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Title and Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = mission.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                StatusBadge(status = mission.status)
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Description
            Text(
                text = mission.description,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Type and Impact
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Mission Type
                MissionTypeChip(type = mission.type)
                
                // Impact Points
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Star,
                        contentDescription = "Impact Points",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = stringResource(R.string.impact_points, mission.impactPoints),
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
            
            // Address if available
            mission.location.address?.let { address ->
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = "Location",
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = address,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: MissionStatus) {
    val backgroundColor = when (status) {
        MissionStatus.AVAILABLE -> Color(0xFFC8E6C9) // Light Green
        MissionStatus.CLAIMED -> Color(0xFFBBDEFB) // Light Blue
        MissionStatus.IN_PROGRESS -> Color(0xFFFFE0B2) // Light Orange
        MissionStatus.PENDING_VERIFICATION -> Color(0xFFE1BEE7) // Light Purple
        MissionStatus.COMPLETED -> Color(0xFFC8E6C9) // Light Green
        MissionStatus.EXPIRED -> Color(0xFFFFCDD2) // Light Red
    }
    
    val textColor = when (status) {
        MissionStatus.AVAILABLE -> Color(0xFF1B5E20)
        MissionStatus.CLAIMED -> Color(0xFF0D47A1)
        MissionStatus.IN_PROGRESS -> Color(0xFFE65100)
        MissionStatus.PENDING_VERIFICATION -> Color(0xFF4A148C)
        MissionStatus.COMPLETED -> Color(0xFF1B5E20)
        MissionStatus.EXPIRED -> Color(0xFFB71C1C)
    }
    
    androidx.compose.material3.Surface(
        color = backgroundColor,
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = status.displayName(),
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun MissionTypeChip(type: MissionType) {
    val (icon, color) = when (type) {
        MissionType.LITTER_COLLECTION -> "\u267B\uFE0F" to Color(0xFF4CAF50)
        MissionType.TREE_PLANTING -> "\uD83C\uDF33" to Color(0xFF2E7D32)
        MissionType.BIO_DIVERSITY -> "\uD83E\uDD8C" to Color(0xFFFF9800)
        MissionType.WATER_QUALITY -> "\uD83D\uDCA7" to Color(0xFF2196F3)
        MissionType.RECYCLING -> "\u267B\uFE0F" to Color(0xFF9C27B0)
        MissionType.RESTORATION -> "\uD83C\uDF31" to Color(0xFF795548)
    }
    
    androidx.compose.material3.Surface(
        color = color.copy(alpha = 0.1f),
        shape = MaterialTheme.shapes.small
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = icon, style = MaterialTheme.typography.bodySmall)
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = type.displayName(),
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
        }
    }
}
