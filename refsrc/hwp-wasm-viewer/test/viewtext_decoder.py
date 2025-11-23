#!/usr/bin/env python3
"""
ViewText 디코더
ViewText 섹션의 특수 구조를 분석하고 텍스트 추출 시도
"""

import struct
import sys
import os
try:
    import olefile
except ImportError:
    print("pip install olefile")
    sys.exit(1)


class ViewTextDecoder:
    """ViewText 전용 디코더"""

    def __init__(self, filepath):
        self.filepath = filepath
        self.ole = None

    def open(self):
        self.ole = olefile.OleFileIO(self.filepath)
        return self

    def close(self):
        if self.ole:
            self.ole.close()

    def __enter__(self):
        return self.open()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def read_stream(self, stream_path):
        try:
            parts = stream_path.split('/')
            return self.ole.openstream(parts).read()
        except:
            return None

    def search_utf16_text(self, data, min_length=20):
        """데이터에서 UTF-16LE 텍스트 블록 검색"""
        results = []

        # 2바이트씩 이동하면서 UTF-16LE 텍스트 찾기
        for start in range(0, len(data) - min_length * 2, 2):
            # 최대 1000바이트 청크 테스트
            end = min(start + 2000, len(data))
            chunk = data[start:end]

            try:
                text = chunk.decode('utf-16le', errors='strict')

                # 유효성 검증
                if len(text) < min_length:
                    continue

                # 인쇄 가능한 문자 비율 계산
                printable = 0
                for i, c in enumerate(text[:100]):
                    code = ord(c)
                    if ((32 <= code <= 126) or
                        (0xAC00 <= code <= 0xD7A3) or
                        code in (10, 13, 9, 32)):
                        printable += 1

                ratio = printable / min(len(text), 100)

                # 70% 이상 인쇄 가능하면 텍스트로 간주
                if ratio >= 0.7:
                    # 실제 텍스트 끝 찾기 (null 종료 또는 비인쇄 문자)
                    actual_text = []
                    for c in text:
                        code = ord(c)
                        if code == 0:
                            break
                        if code >= 32 or c in '\n\t':
                            actual_text.append(c)
                        elif len(actual_text) > 0:
                            break

                    final_text = ''.join(actual_text).strip()

                    if len(final_text) >= min_length:
                        results.append({
                            'offset': start,
                            'length': len(final_text),
                            'text': final_text,
                            'ratio': ratio
                        })

                        # 이 텍스트를 건너뛰고 다음으로
                        start = start + len(final_text) * 2

            except:
                continue

        return results

    def analyze_viewtext_structure(self, data):
        """ViewText 구조 분석"""
        print(f"\nViewText 구조 분석")
        print("=" * 70)

        # 헤더 분석 (처음 256바이트는 헤더로 추정)
        if len(data) < 256:
            print("데이터가 너무 작습니다")
            return

        print(f"\n헤더 (처음 256바이트):")
        header = data[:256]

        # 첫 4바이트
        first_dword = struct.unpack('<I', header[0:4])[0]
        print(f"  첫 DWORD: 0x{first_dword:08x}")
        print(f"    - 바이트 0: 0x{header[0]:02x} (항상 0x1c)")
        print(f"    - 바이트 1-3: 0x{struct.unpack('<I', header[0:4])[0] >> 8:06x}")

        # 다음 구조들
        print(f"  오프셋 0x04-0x07: {header[4:8].hex()}")
        print(f"  오프셋 0x08-0x0b: {header[8:12].hex()}")

        # 바디 분석 (256바이트 이후)
        body = data[256:]
        print(f"\n바디 크기: {len(body)} bytes")

        # 바디에서 텍스트 검색
        print(f"\n텍스트 블록 검색 중...")
        texts = self.search_utf16_text(body, min_length=15)

        print(f"발견된 텍스트 블록: {len(texts)}개")
        for i, item in enumerate(texts[:10]):
            preview = item['text'][:80].replace('\n', ' ')
            if len(item['text']) > 80:
                preview += '...'
            print(f"\n[{i+1}] Offset: 0x{item['offset']:04x} (256 + 0x{item['offset']:04x})")
            print(f"    길이: {item['length']}자, 비율: {item['ratio']:.1%}")
            print(f"    \"{preview}\"")

        return texts

    def decode_section(self, section_index):
        """ViewText 섹션 디코드"""
        stream_path = f'ViewText/Section{section_index}'
        data = self.read_stream(stream_path)

        if not data:
            return None

        print(f"\n{'#'*70}")
        print(f"# ViewText/Section{section_index}")
        print(f"{'#'*70}")
        print(f"크기: {len(data)} bytes")

        texts = self.analyze_viewtext_structure(data)

        return texts

    def decode_all_sections(self):
        """모든 ViewText 섹션 디코드"""
        all_texts = []

        for i in range(10):
            texts = self.decode_section(i)
            if texts is None:
                break
            if texts:
                all_texts.extend(texts)

        # 최종 결과
        print(f"\n{'='*70}")
        print(f"최종 결과")
        print(f"{'='*70}")
        print(f"총 텍스트 블록: {len(all_texts)}개")

        if all_texts:
            # 전체 텍스트 병합
            merged = '\n\n'.join(t['text'] for t in all_texts)

            print(f"\n전체 텍스트 (처음 1000자):")
            print("-" * 70)
            print(merged[:1000])
            if len(merged) > 1000:
                print("\n...")
            print("-" * 70)

            # 파일로 저장
            output_file = self.filepath.replace('.hwp', '_viewtext.txt')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write("# ViewText에서 추출한 텍스트\n\n")
                for i, item in enumerate(all_texts):
                    f.write(f"## 블록 {i+1} (Section, Offset 0x{item['offset']:04x})\n")
                    f.write(item['text'])
                    f.write('\n\n')

            print(f"\n전체 텍스트 저장: {output_file}")
            print(f"총 {len(merged)}자")

        return all_texts


def main():
    if len(sys.argv) < 2:
        print("사용법: python viewtext_decoder.py <hwp_file>")
        sys.exit(1)

    hwp_file = sys.argv[1]

    try:
        with ViewTextDecoder(hwp_file) as decoder:
            decoder.decode_all_sections()
    except Exception as e:
        print(f"\n오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
