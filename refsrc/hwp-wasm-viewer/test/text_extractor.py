#!/usr/bin/env python3
"""
HWP 본문 텍스트 추출기
ViewText와 BodyText 섹션에서 본문 텍스트를 추출하는 실험 도구
"""

import struct
import sys
import os
try:
    import olefile
except ImportError:
    print("olefile 라이브러리가 필요합니다:")
    print("pip install olefile")
    sys.exit(1)

import zlib


class TextExtractor:
    """본문 텍스트 추출 클래스"""

    TAG_NAMES = {
        0x10: 'DOCUMENT_PROPERTIES',
        0x50: 'PARA_HEADER',
        0x51: 'PARA_TEXT',
        0x52: 'PARA_CHAR_SHAPE',
        0x53: 'PARA_LINE_SEG',
        0x55: 'CTRL_HEADER',
    }

    def __init__(self, filepath):
        self.filepath = filepath
        self.ole = None
        self.file_header = None

    def open(self):
        if not os.path.exists(self.filepath):
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {self.filepath}")
        self.ole = olefile.OleFileIO(self.filepath)
        return self

    def close(self):
        if self.ole:
            self.ole.close()

    def __enter__(self):
        return self.open()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def read_stream(self, stream_name):
        """스트림 읽기"""
        try:
            if isinstance(stream_name, list):
                return self.ole.openstream(stream_name).read()
            else:
                parts = stream_name.split('/')
                return self.ole.openstream(parts).read()
        except:
            return None

    def parse_file_header(self):
        """FileHeader 파싱"""
        data = self.read_stream('FileHeader')
        if not data or len(data) < 256:
            return None

        flags_raw = struct.unpack('<I', data[36:40])[0]
        self.file_header = {
            'compressed': bool(flags_raw & 0x01)
        }
        return self.file_header

    def try_decode_utf16(self, data, min_length=10):
        """UTF-16LE 텍스트 디코딩 시도"""
        if len(data) < 2:
            return None

        try:
            text = data.decode('utf-16le', errors='ignore')

            # 유효성 검증: 인쇄 가능한 문자 비율
            if len(text) < min_length:
                return None

            printable_count = 0
            total_count = min(len(text), 100)

            for i in range(total_count):
                code = ord(text[i])
                # ASCII 인쇄 가능, 한글, 개행/탭
                if ((32 <= code <= 126) or
                    (0xAC00 <= code <= 0xD7A3) or
                    code in (10, 13, 9)):
                    printable_count += 1

            # 60% 이상 인쇄 가능하면 텍스트로 간주
            if printable_count / total_count >= 0.6:
                # 제어 문자 필터링
                cleaned = ''.join(c for c in text if ord(c) >= 32 or c in '\n\t')
                return cleaned if len(cleaned) >= min_length else None

        except:
            pass

        return None

    def parse_records_standard(self, data, is_compressed=False):
        """표준 레코드 파싱 (BodyText)"""
        # 스트림 전체 압축 해제
        if is_compressed and len(data) > 0:
            try:
                data = zlib.decompress(data, -15)
            except:
                try:
                    data = zlib.decompress(data)
                except:
                    pass

        records = []
        offset = 0

        while offset < len(data) - 4:
            try:
                header = struct.unpack('<I', data[offset:offset+4])[0]
                offset += 4

                tag_id = header & 0x3FF
                level = (header >> 10) & 0x3FF
                size = (header >> 20) & 0xFFF

                if size == 0xFFF:
                    if offset + 4 > len(data):
                        break
                    size = struct.unpack('<I', data[offset:offset+4])[0]
                    offset += 4

                if offset + size > len(data):
                    break

                record_data = data[offset:offset+size]
                offset += size

                records.append({
                    'tag_id': tag_id,
                    'tag_name': self.TAG_NAMES.get(tag_id, f'0x{tag_id:02x}'),
                    'level': level,
                    'size': size,
                    'data': record_data,
                    'offset': offset - size - 4
                })

            except:
                break

        return records

    def extract_text_from_records(self, records):
        """레코드에서 텍스트 추출"""
        texts = []

        # 방법 1: PARA_HEADER + PARA_TEXT 표준 구조
        for i, record in enumerate(records):
            if record['tag_id'] == 0x50:  # PARA_HEADER
                if i + 1 < len(records) and records[i + 1]['tag_id'] == 0x51:
                    text = self.try_decode_utf16(records[i + 1]['data'])
                    if text:
                        texts.append({
                            'method': 'PARA_HEADER+TEXT',
                            'text': text,
                            'tag': '0x50+0x51'
                        })

        # 방법 2: PARA_TEXT 단독
        for record in records:
            if record['tag_id'] == 0x51:  # PARA_TEXT
                # 이미 방법 1에서 추출된 것인지 확인
                already_extracted = any(
                    t['method'] == 'PARA_HEADER+TEXT' and t['text'] == self.try_decode_utf16(record['data'])
                    for t in texts
                )
                if not already_extracted:
                    text = self.try_decode_utf16(record['data'])
                    if text:
                        texts.append({
                            'method': 'PARA_TEXT',
                            'text': text,
                            'tag': '0x51'
                        })

        # 방법 3: 휴리스틱 - 모든 레코드에서 텍스트 시도
        for record in records:
            if record['tag_id'] not in (0x50, 0x51) and record['size'] >= 20:
                text = self.try_decode_utf16(record['data'], min_length=20)
                if text:
                    # 이미 추출된 텍스트인지 확인
                    already_exists = any(t['text'] == text for t in texts)
                    if not already_exists:
                        texts.append({
                            'method': 'HEURISTIC',
                            'text': text,
                            'tag': f"0x{record['tag_id']:02x}"
                        })

        return texts

    def analyze_viewtext_raw(self, data, section_index):
        """ViewText 원본 바이트 분석"""
        print(f"\n{'='*70}")
        print(f"ViewText/Section{section_index} 원본 바이트 분석")
        print(f"{'='*70}")
        print(f"전체 크기: {len(data)} bytes")
        print(f"\n첫 64바이트 (hex):")
        print(data[:64].hex(' ', 2))

        print(f"\n첫 64바이트 (바이트 값):")
        for i in range(0, min(64, len(data)), 16):
            hex_part = ' '.join(f'{b:02x}' for b in data[i:i+16])
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in data[i:i+16])
            print(f"{i:04x}: {hex_part:<48} {ascii_part}")

        # 특정 패턴 찾기
        print(f"\n\n패턴 분석:")

        # 1. UTF-16LE 텍스트 블록 찾기 (연속된 한글/영문)
        print(f"\n1) UTF-16LE 텍스트 블록 탐지:")
        for offset in range(0, min(len(data) - 200, 5000), 2):
            chunk = data[offset:offset+200]
            text = self.try_decode_utf16(chunk, min_length=15)
            if text:
                print(f"   Offset 0x{offset:04x}: \"{text[:60]}{'...' if len(text) > 60 else ''}\"")

        # 2. 반복되는 헤더 패턴 찾기
        print(f"\n2) 4바이트 헤더 패턴 분석 (첫 20개):")
        for i in range(0, min(len(data) - 4, 200), 4):
            if i % 80 == 0:  # 20번째마다
                header = struct.unpack('<I', data[i:i+4])[0]
                tag_id = header & 0x3FF
                level = (header >> 10) & 0x3FF
                size = (header >> 20) & 0xFFF

                print(f"   Offset 0x{i:04x}: "
                      f"header=0x{header:08x} "
                      f"tag=0x{tag_id:03x} "
                      f"level={level:3d} "
                      f"size={size:4d}")

        # 3. 0x1c 바이트 위치 찾기 (ViewText 마커)
        print(f"\n3) 0x1c 바이트 위치:")
        positions = [i for i in range(min(500, len(data))) if data[i] == 0x1c]
        if positions:
            print(f"   발견 위치: {positions[:10]}")
            for pos in positions[:3]:
                if pos + 32 < len(data):
                    context = data[pos:pos+32].hex(' ', 2)
                    print(f"   Offset 0x{pos:04x}: {context}")

    def extract_from_section(self, section_path, section_index):
        """섹션에서 텍스트 추출"""
        data = self.read_stream(section_path)
        if not data:
            return None

        print(f"\n{'='*70}")
        print(f"섹션: {section_path}")
        print(f"{'='*70}")
        print(f"크기: {len(data)} bytes")
        print(f"첫 바이트: 0x{data[0]:02x}")

        # ViewText인지 판단 (0x1c로 시작)
        is_viewtext = data[0] == 0x1c

        if is_viewtext:
            print(f"타입: ViewText (비압축)")
            # ViewText 원본 바이트 분석
            self.analyze_viewtext_raw(data, section_index)
            is_compressed = False
        else:
            print(f"타입: BodyText (압축 여부: {self.file_header['compressed']})")
            is_compressed = self.file_header['compressed']

        # 표준 레코드 파싱 시도
        records = self.parse_records_standard(data, is_compressed)
        print(f"\n파싱된 레코드 수: {len(records)}")

        if records:
            # 레코드 타입 통계
            tag_counts = {}
            for r in records:
                tag_counts[r['tag_name']] = tag_counts.get(r['tag_name'], 0) + 1

            print(f"레코드 타입: {dict(list(tag_counts.items())[:5])}")

        # 텍스트 추출 시도
        texts = self.extract_text_from_records(records)

        print(f"\n추출된 텍스트: {len(texts)}개")
        for i, item in enumerate(texts[:5]):
            preview = item['text'][:60].replace('\n', ' ')
            if len(item['text']) > 60:
                preview += '...'
            print(f"  [{item['method']}] {item['tag']}: \"{preview}\"")

        return {
            'section': section_path,
            'is_viewtext': is_viewtext,
            'records': records,
            'texts': texts
        }

    def extract_all_text(self):
        """모든 섹션에서 텍스트 추출"""
        # FileHeader 먼저 파싱
        self.parse_file_header()

        all_texts = []

        # BodyText 섹션
        print(f"\n{'#'*70}")
        print(f"# BodyText 섹션 분석")
        print(f"{'#'*70}")
        for i in range(10):
            result = self.extract_from_section(f'BodyText/Section{i}', i)
            if not result:
                break
            if result['texts']:
                all_texts.extend(result['texts'])

        # ViewText 섹션
        print(f"\n{'#'*70}")
        print(f"# ViewText 섹션 분석")
        print(f"{'#'*70}")
        for i in range(10):
            result = self.extract_from_section(f'ViewText/Section{i}', i)
            if not result:
                break
            if result['texts']:
                all_texts.extend(result['texts'])

        # 최종 결과
        print(f"\n{'='*70}")
        print(f"최종 결과")
        print(f"{'='*70}")
        print(f"총 추출된 텍스트: {len(all_texts)}개")

        if all_texts:
            print(f"\n전체 텍스트 병합 (처음 500자):")
            print("-" * 70)
            merged = '\n\n'.join(t['text'] for t in all_texts)
            print(merged[:500])
            if len(merged) > 500:
                print("...")
            print("-" * 70)

            # 파일로 저장
            output_file = self.filepath.replace('.hwp', '_extracted.txt')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(merged)
            print(f"\n전체 텍스트를 저장했습니다: {output_file}")

        return all_texts


def main():
    if len(sys.argv) < 2:
        print("사용법: python text_extractor.py <hwp_file>")
        print("예제: python text_extractor.py test.hwp")
        sys.exit(1)

    hwp_file = sys.argv[1]

    try:
        with TextExtractor(hwp_file) as extractor:
            extractor.extract_all_text()
    except Exception as e:
        print(f"\n오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
