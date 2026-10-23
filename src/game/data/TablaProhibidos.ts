// Tabla de Prohibidos (Clase x Tipo)
// S=Alta afinidad, A=Buena, B=Normal, C=Baja, X=Prohibido

export const TABLA_PROHIBIDOS = {
  Assassin: { Dagger: 'S', Shadow: 'S', Venom: 'S', Evasion: 'S', Sword: 'A', Wind: 'A', Mace: 'X', Greatsword: 'X', LightStaff: 'X', Longbow: 'C' },
  Warrior:  { Sword: 'S', Shield: 'S', Fire: 'A', Earth: 'A', Dagger: 'B', Mace: 'S', LightStaff: 'X', Shadow: 'C', Longbow: 'B' },
  Mage:     { LightStaff: 'S', Fire: 'S', Frost: 'S', Wind: 'A', Shadow: 'A', Dagger: 'X', Mace: 'X', Shield: 'X', Longbow: 'C' },
  Tank:     { Shield: 'S', Earth: 'S', Mace: 'S', Fire: 'B', Dagger: 'X', Evasion: 'X', Longbow: 'X', Shadow: 'B' },
  Archer:   { Longbow: 'S', Wind: 'S', Evasion: 'A', Dagger: 'A', Sword: 'C', Mace: 'X', Shield: 'X', Fire: 'B' },
  Cleric:   { LightStaff: 'S', Nature: 'S', Shield: 'B', Shadow: 'C', Mace: 'A', Fire: 'C', Dagger: 'X', Longbow: 'X' },
  Rogue:    { Dagger: 'S', Evasion: 'S', Shadow: 'A', Mace: 'C', Longbow: 'A', Sword: 'B', Shield: 'X', LightStaff: 'X' },
  Berserker:{ Greatsword: 'S', Mace: 'S', Fire: 'S', Earth: 'B', Dagger: 'X', Shield: 'X', Evasion: 'C', Longbow: 'X' }
};
