import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Name = 'treinar' | 'historico' | 'fichas' | 'exercicios' | 'ajustes';

const PATHS: Record<Name, string[]> = {
  treinar: ['M5 9v6M8 7v10M16 7v10M19 9v6M8 12h8'],
  historico: ['M4 6h16v14H4z', 'M4 10h16M9 3v4M15 3v4'],
  fichas: ['M3 7h7l2 2h9v10H3z'],
  exercicios: ['M4 19l5-6 4 3 7-9', 'M15 7h5v5'],
  ajustes: [
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z',
    'M19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.8 1l-.3 2h-3.6l-.3-2a7 7 0 0 1-1.8-1l-1.9.7-1.8-3.1 1.6-1.2a7 7 0 0 1 0-2.1L3 10.3l1.8-3.1 1.9.7a7 7 0 0 1 1.8-1l.3-2h3.6l.3 2a7 7 0 0 1 1.8 1l1.9-.7 1.8 3.1-1.6 1.2a7 7 0 0 1 0 2.1Z',
  ],
};

export function Icon({ name, color, size = 22 }: { name: Name; color: ColorValue; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS[name].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}
