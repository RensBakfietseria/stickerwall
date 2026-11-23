import { describe, expect, it } from 'vitest';
import { CREATURES, QUALITIES, creatureName, toggleQuality } from '../src/stickerwall/model.ts';

describe('Stickerwall prototype', () => {
  it('includes three unique creatures', () => {
    expect(CREATURES.map((item) => item.id)).toEqual(['axolotl', 'dragon', 'penguin']);
  });
  it('has no duplicate qualities', () => {
    expect(new Set(QUALITIES).size).toBe(QUALITIES.length);
  });
  it('limits selections to three', () => {
    expect(toggleQuality(['Creatief', 'Zorgzaam', 'Humor'], 'Vindingrijk')).toEqual(['Creatief', 'Zorgzaam', 'Humor']);
  });
  it('allows deselection', () => {
    expect(toggleQuality(['Creatief', 'Zorgzaam'], 'Creatief')).toEqual(['Zorgzaam']);
  });
  it('generates a character name deterministically', () => {
    expect(creatureName('penguin', ['Humor'])).toBe('De Pinguïn van de Prettige Chaos');
    expect(creatureName('axolotl', ['Verbindend'])).toBe('De Diplomatieke Diepzeeduiker');
  });
});
