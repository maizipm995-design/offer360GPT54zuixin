import { describe, expect, it } from 'vitest';
import { collectRichTextImageUrls, normalizeRichTextContent, parseOptionLines } from './campus-exam.utils';

describe('campus-exam.utils', () => {
  it('支持解析模板里的富文本选项分隔符', () => {
    const result = parseOptionLines('<p>选项1</p>|||<p>选项2</p>|||<p>选项3</p>');

    expect(result).toEqual([
      { key: 'A', label: 'A', value: '<p>选项1</p>' },
      { key: 'B', label: 'B', value: '<p>选项2</p>' },
      { key: 'C', label: 'C', value: '<p>选项3</p>' },
    ]);
  });

  it('会把裸图片链接转成 img 标签', () => {
    expect(normalizeRichTextContent('https://static.example.com/demo.png')).toBe(
      '<img src="https://static.example.com/demo.png" alt="图片" />',
    );
  });

  it('能收集富文本中的图片地址用于导入校验', () => {
    const result = collectRichTextImageUrls(
      '<p>https://static.example.com/demo.png</p><img src="https://static.example.com/inner.jpg" alt="x" />',
    );

    expect(result).toEqual([
      'https://static.example.com/inner.jpg',
      'https://static.example.com/demo.png',
    ]);
  });
});
