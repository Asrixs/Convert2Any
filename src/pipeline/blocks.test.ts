import { describe, expect, it } from 'vitest';
import { blocksToText, decodeEntities, parseHtmlBlocks } from './blocks';

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a &amp; b')).toBe('a & b');
    expect(decodeEntities('&lt;tag&gt;')).toBe('<tag>');
    expect(decodeEntities('&#65;&#66;')).toBe('AB');
    expect(decodeEntities('&#x41;')).toBe('A');
    expect(decodeEntities('caf&eacute;')).toBe('café');
  });

  it('leaves unknown or malformed entities untouched', () => {
    expect(decodeEntities('&notareal;')).toBe('&notareal;');
    expect(decodeEntities('100% &')).toBe('100% &');
  });
});

describe('parseHtmlBlocks', () => {
  it('extracts headings and paragraphs in order', () => {
    const blocks = parseHtmlBlocks('<h1>Title</h1><p>Hello world</p>');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
    expect(blocks[1]).toMatchObject({ type: 'paragraph' });
    expect(blocksToText(blocks)).toBe('Title\nHello world');
  });

  it('tracks bold and italic as runs within a paragraph', () => {
    const [block] = parseHtmlBlocks('<p>Revenue grew <strong>18%</strong> this <em>year</em>.</p>');
    expect(block?.type).toBe('paragraph');
    if (block?.type !== 'paragraph') throw new Error('expected a paragraph');
    expect(block.runs.find((r) => r.text.includes('18%'))?.bold).toBe(true);
    expect(block.runs.find((r) => r.text.includes('year'))?.italic).toBe(true);
  });

  it('numbers ordered lists and bullets unordered ones', () => {
    const blocks = parseHtmlBlocks('<ol><li>first</li><li>second</li></ol><ul><li>dot</li></ul>');
    const items = blocks.filter((b) => b.type === 'list-item');
    expect(items).toHaveLength(3);
    expect(items.map((i) => (i.type === 'list-item' ? i.marker : ''))).toEqual(['1.', '2.', '•']);
  });

  it('builds table rows with their cells', () => {
    const blocks = parseHtmlBlocks(
      '<table><tr><th>Name</th><th>Qty</th></tr><tr><td>Bolt</td><td>4</td></tr></table>',
    );
    const table = blocks.find((b) => b.type === 'table');
    expect(table).toMatchObject({
      type: 'table',
      rows: [
        ['Name', 'Qty'],
        ['Bolt', '4'],
      ],
    });
  });

  it('ignores script and style content entirely', () => {
    const blocks = parseHtmlBlocks(
      '<p>Keep</p><script>var leak = 1;</script><style>.x{color:red}</style>',
    );
    expect(blocksToText(blocks)).toBe('Keep');
  });

  it('preserves whitespace inside <pre> but collapses it elsewhere', () => {
    const blocks = parseHtmlBlocks('<p>a    b</p><pre>x\n  y</pre>');
    expect(blocksToText(blocks)).toBe('a b\nx\n  y');
  });

  it('emits a rule for <hr> and drops comments and doctype', () => {
    const blocks = parseHtmlBlocks('<!doctype html><!-- note --><p>A</p><hr><p>B</p>');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'rule', 'paragraph']);
  });

  it('lets text inside unknown tags through', () => {
    expect(blocksToText(parseHtmlBlocks('<custom-el>visible</custom-el>'))).toBe('visible');
  });

  it('returns nothing for empty or whitespace-only input', () => {
    expect(parseHtmlBlocks('')).toEqual([]);
    expect(parseHtmlBlocks('<p>   </p>')).toEqual([]);
  });

  it('handles a full document with head and body', () => {
    const blocks = parseHtmlBlocks(
      '<html><head><title>T</title></head><body><h2>Report</h2><p>Body</p></body></html>',
    );
    const text = blocksToText(blocks);
    expect(text).toContain('Report');
    expect(text).toContain('Body');
  });
});

describe('document chrome and entities', () => {
  it('leaves the <title> and other non-content elements off the page', () => {
    const blocks = parseHtmlBlocks(
      '<html><head><title>Browser tab text</title></head><body><p>Body text</p>' +
        '<svg><title>Icon label</title></svg><template><p>Inert</p></template></body></html>',
    );
    expect(blocksToText(blocks)).toBe('Body text');
  });

  it('does not swallow the document after a self-closing <svg/>', () => {
    expect(blocksToText(parseHtmlBlocks('<svg/><p>Still here</p>'))).toBe('Still here');
  });

  it('decodes currency entities and keeps entity case', () => {
    expect(decodeEntities('&euro;5 &pound;3')).toBe('€5 £3');
    expect(decodeEntities('&Eacute;t&eacute;')).toBe('Été');
    expect(decodeEntities('&AMP;')).toBe('&');
  });
});
