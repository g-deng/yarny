import React from 'react';
import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';
import { BrutalColors } from '@/constants/theme';

interface HatchPatternProps {
  width: number | string;
  height: number | string;
  color?: string;
  spacing?: number;
  strokeWidth?: number;
}

export function HatchPattern({
  width,
  height,
  color = BrutalColors.outline,
  spacing = 8,
  strokeWidth = 2,
}: HatchPatternProps) {
  const id = React.useId();
  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={spacing}
          height={spacing}
          patternTransform="rotate(45)"
        >
          <Line
            x1={0}
            y1={0}
            x2={0}
            y2={spacing}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
