#!/usr/bin/env python3
"""
HWP File Analyzer
HWP 5.0 파일 구조를 분석하는 Python 도구
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

try:
    import zlib
except ImportError:
    print("zlib 모듈이 필요합니다 (Python 기본 제공)")
    sys.exit(1)


class HWPAnalyzer:
    """HWP 파일 분석 클래스"""

    # 태그 ID 맵핑
    TAG_NAMES = {
        0x10: 'DOCUMENT_PROPERTIES',
        0x11: 'ID_MAPPINGS',
        0x12: 'BIN_DATA',
        0x13: 'FACE_NAME',
        0x14: 'BORDER_FILL',
        0x15: 'CHAR_SHAPE',
        0x16: 'TAB_DEF',
        0x17: 'NUMBERING',
        0x18: 'BULLET',
        0x19: 'PARA_SHAPE',
        0x1A: 'STYLE',
        0x50: 'PARA_HEADER',
        0x51: 'PARA_TEXT',
        0x52: 'PARA_CHAR_SHAPE',
        0x53: 'PARA_LINE_SEG',
        0x54: 'PARA_RANGE_TAG',
        0x55: 'CTRL_HEADER',
        0x56: 'LIST_HEADER',
        0x57: 'PAGE_DEF',
        0x58: 'FOOTNOTE_SHAPE',
        0x59: 'PAGE_BORDER_FILL',
        0x5A: 'SHAPE_COMPONENT',
        0x5B: 'TABLE'
    }

    def __init__(self, filepath):
        """초기화"""
        self.filepath = filepath
        self.ole = None
        self.file_header = None

    def open(self):
        """HWP 파일 열기"""
        if not os.path.exists(self.filepath):
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {self.filepath}")

        self.ole = olefile.OleFileIO(self.filepath)
        return self

    def close(self):
        """HWP 파일 닫기"""
        if self.ole:
            self.ole.close()

    def __enter__(self):
        """컨텍스트 관리자 진입"""
        return self.open()

    def __exit__(self, exc_type, exc_val, exc_tb):
        """컨텍스트 관리자 종료"""
        self.close()

    def list_streams(self):
        """모든 스트림 목록 반환"""
        return self.ole.listdir()

    def read_stream(self, stream_name):
        """특정 스트림 읽기"""
        try:
            if isinstance(stream_name, list):
                return self.ole.openstream(stream_name).read()
            else:
                # 문자열인 경우 리스트로 변환
                parts = stream_name.split('/')
                return self.ole.openstream(parts).read()
        except:
            return None

    def parse_file_header(self):
        """FileHeader 파싱"""
        data = self.read_stream('FileHeader')
        if not data or len(data) < 256:
            raise ValueError("FileHeader가 유효하지 않습니다")

        # Signature (32 bytes)
        signature = data[:32].decode('utf-8', errors='ignore').rstrip('\x00')

        # Version (4 bytes) - Little Endian
        version_raw = struct.unpack('<I', data[32:36])[0]
        version = {
            'raw': version_raw,
            'major': (version_raw >> 24) & 0xFF,
            'minor': (version_raw >> 16) & 0xFF,
            'patch': (version_raw >> 8) & 0xFF,
            'revision': version_raw & 0xFF
        }
        version['string'] = f"{version['major']}.{version['minor']}.{version['patch']}.{version['revision']}"

        # Flags (4 bytes)
        flags_raw = struct.unpack('<I', data[36:40])[0]
        flags = {
            'raw': flags_raw,
            'compressed': bool(flags_raw & 0x01),
            'encrypted': bool(flags_raw & 0x02),
            'distribution': bool(flags_raw & 0x04),
            'script': bool(flags_raw & 0x08),
            'drm': bool(flags_raw & 0x10),
            'xmlTemplate': bool(flags_raw & 0x20),
            'history': bool(flags_raw & 0x40),
            'signature': bool(flags_raw & 0x80),
            'certificate': bool(flags_raw & 0x100)
        }

        # Flags2 (4 bytes)
        flags2_raw = struct.unpack('<I', data[40:44])[0]

        # Encrypt Version (4 bytes)
        encrypt_version = struct.unpack('<I', data[44:48])[0]

        # KOGL License (1 byte)
        kogl_license = struct.unpack('B', data[48:49])[0]

        self.file_header = {
            'signature': signature,
            'version': version,
            'flags': flags,
            'flags2': flags2_raw,
            'encrypt_version': encrypt_version,
            'kogl_license': kogl_license
        }

        return self.file_header

    def parse_records(self, data, is_compressed=False):
        """레코드 구조 파싱"""
        # 먼저 전체 스트림 압축 해제 시도
        if is_compressed and len(data) > 0:
            try:
                data = zlib.decompress(data, -15)  # raw deflate
                print(f"  [INFO] 전체 스트림 압축 해제 성공: {len(data)} bytes")
            except:
                try:
                    data = zlib.decompress(data)
                    print(f"  [INFO] 전체 스트림 압축 해제 성공 (zlib): {len(data)} bytes")
                except:
                    print(f"  [WARNING] 전체 스트림 압축 해제 실패, 원본 사용")

        records = []
        offset = 0

        while offset < len(data) - 4:
            try:
                # 레코드 헤더 (4 bytes, Little Endian)
                header = struct.unpack('<I', data[offset:offset+4])[0]
                offset += 4

                tag_id = header & 0x3FF           # 10 bits
                level = (header >> 10) & 0x3FF    # 10 bits
                size = (header >> 20) & 0xFFF     # 12 bits

                # Size가 0xFFF인 경우 다음 4바이트에서 실제 크기 읽기
                if size == 0xFFF:
                    if offset + 4 > len(data):
                        break
                    size = struct.unpack('<I', data[offset:offset+4])[0]
                    offset += 4

                # 데이터 범위 확인
                if offset + size > len(data):
                    print(f"  [WARNING] 레코드 크기 초과: tagId=0x{tag_id:02x}, offset={offset}, size={size}, data_len={len(data)}")
                    break

                # 레코드 데이터 읽기 (이미 스트림 단위로 압축 해제됨)
                record_data = data[offset:offset+size]
                offset += size

                records.append({
                    'tag_id': tag_id,
                    'tag_name': self.TAG_NAMES.get(tag_id, f'UNKNOWN(0x{tag_id:02x})'),
                    'level': level,
                    'size': size,
                    'data': record_data
                })

            except Exception as e:
                print(f"  [ERROR] 레코드 파싱 오류 at offset {offset}: {e}")
                break

        return records

    def parse_para_text(self, data):
        """문단 텍스트 파싱 (UTF-16LE)"""
        try:
            text = data.decode('utf-16le', errors='ignore')
            # 제어 문자 필터링
            text = ''.join(c for c in text if ord(c) >= 32 or c == '\n' or c == '\t')
            return text
        except:
            return ""

    def analyze_section(self, section_index):
        """섹션 분석"""
        # BodyText/SectionX 또는 SectionX 시도
        section_name = f'BodyText/Section{section_index}'
        data = self.read_stream(section_name)

        if not data:
            section_name = f'Section{section_index}'
            data = self.read_stream(section_name)

        if not data:
            return None

        print(f"\n{'='*60}")
        print(f"Section {section_index} ({section_name})")
        print(f"{'='*60}")
        print(f"원본 크기: {len(data)} bytes")
        print(f"첫 4바이트: 0x{data[:4].hex()}")

        # 레코드 파싱
        is_compressed = self.file_header['flags']['compressed'] if self.file_header else False
        records = self.parse_records(data, is_compressed)

        print(f"파싱된 레코드 수: {len(records)}")

        # 레코드 타입별 통계
        tag_counts = {}
        for record in records:
            tag_name = record['tag_name']
            tag_counts[tag_name] = tag_counts.get(tag_name, 0) + 1

        print(f"\n레코드 타입별 분포:")
        for tag_name, count in sorted(tag_counts.items()):
            print(f"  {tag_name}: {count}개")

        # 문단 추출
        paragraphs = []
        for i, record in enumerate(records):
            if record['tag_id'] == 0x50:  # PARA_HEADER
                text = ""
                # 다음 레코드가 PARA_TEXT인지 확인
                if i + 1 < len(records) and records[i + 1]['tag_id'] == 0x51:
                    text = self.parse_para_text(records[i + 1]['data'])
                paragraphs.append(text)

        print(f"\n추출된 문단 수: {len(paragraphs)}")

        # 문단 미리보기
        if paragraphs:
            print(f"\n문단 미리보기 (처음 5개):")
            for i, text in enumerate(paragraphs[:5]):
                preview = text[:50].replace('\n', ' ')
                if len(text) > 50:
                    preview += '...'
                print(f"  P{i}: ({len(text)}자) \"{preview}\"")

        return {
            'section_index': section_index,
            'section_name': section_name,
            'raw_size': len(data),
            'records': records,
            'paragraphs': paragraphs
        }

    def analyze_docinfo(self):
        """DocInfo 분석"""
        data = self.read_stream('DocInfo')
        if not data:
            print("DocInfo 스트림을 찾을 수 없습니다")
            return None

        print(f"\n{'='*60}")
        print(f"DocInfo")
        print(f"{'='*60}")
        print(f"원본 크기: {len(data)} bytes")

        # 레코드 파싱
        is_compressed = self.file_header['flags']['compressed'] if self.file_header else False
        records = self.parse_records(data, is_compressed)

        print(f"파싱된 레코드 수: {len(records)}")

        # 레코드 타입별 통계
        tag_counts = {}
        for record in records:
            tag_name = record['tag_name']
            tag_counts[tag_name] = tag_counts.get(tag_name, 0) + 1

        print(f"\n레코드 타입별 분포:")
        for tag_name, count in sorted(tag_counts.items()):
            print(f"  {tag_name}: {count}개")

        return {
            'raw_size': len(data),
            'records': records
        }

    def analyze_prvtext(self):
        """PrvText 분석"""
        data = self.read_stream('PrvText')
        if not data:
            return None

        print(f"\n{'='*60}")
        print(f"PrvText (미리보기 텍스트)")
        print(f"{'='*60}")
        print(f"원본 크기: {len(data)} bytes")

        # UTF-16LE 디코딩
        try:
            text = data.decode('utf-16le', errors='ignore')
            # 제어 문자 필터링
            text = ''.join(c for c in text if ord(c) >= 32 or c == '\n' or c == '\t')

            print(f"텍스트 길이: {len(text)} 문자")
            print(f"\n미리보기 (처음 200자):")
            print("-" * 60)
            print(text[:200])
            if len(text) > 200:
                print("...")
            print("-" * 60)

            return text
        except Exception as e:
            print(f"디코딩 오류: {e}")
            return None

    def print_file_structure(self):
        """파일 구조 출력"""
        print(f"\n{'='*60}")
        print(f"HWP 파일 구조")
        print(f"{'='*60}")

        streams = self.list_streams()

        # 스토리지별로 그룹화
        storages = {}
        for stream in streams:
            if len(stream) == 1:
                # 루트 레벨
                storages.setdefault('ROOT', []).append(stream[0])
            else:
                # 스토리지 하위
                storage_name = stream[0]
                storages.setdefault(storage_name, []).append('/'.join(stream[1:]))

        for storage_name, items in sorted(storages.items()):
            print(f"\n📁 {storage_name}:")
            for item in sorted(items):
                print(f"  📄 {item}")

    def full_analysis(self):
        """전체 분석 실행"""
        print(f"HWP 파일 분석: {self.filepath}")
        print(f"파일 크기: {os.path.getsize(self.filepath):,} bytes")

        # 파일 구조
        self.print_file_structure()

        # FileHeader
        print(f"\n{'='*60}")
        print(f"FileHeader")
        print(f"{'='*60}")
        header = self.parse_file_header()
        print(f"서명: {header['signature']}")
        print(f"버전: {header['version']['string']}")
        print(f"압축 여부: {header['flags']['compressed']}")
        print(f"암호화 여부: {header['flags']['encrypted']}")
        print(f"플래그: 0x{header['flags']['raw']:08x}")

        # PrvText
        self.analyze_prvtext()

        # DocInfo
        self.analyze_docinfo()

        # BodyText Sections
        section_count = 0
        for i in range(10):  # 최대 10개 섹션 시도
            result = self.analyze_section(i)
            if not result:
                break
            section_count += 1

        # ViewText Sections (추가로 확인)
        print(f"\n{'='*60}")
        print(f"ViewText Sections (참고용)")
        print(f"{'='*60}")
        for i in range(10):
            viewtext_name = f'ViewText/Section{i}'
            data = self.read_stream(viewtext_name)
            if data:
                print(f"\n{viewtext_name}: {len(data)} bytes")
                # ViewText는 일반적으로 압축되지 않음
                is_compressed = self.file_header['flags']['compressed'] if self.file_header else False
                records = self.parse_records(data, is_compressed)
                print(f"  레코드 수: {len(records)}")
            else:
                break

        print(f"\n{'='*60}")
        print(f"분석 완료: 총 {section_count}개 BodyText 섹션")
        print(f"{'='*60}")


def main():
    """메인 함수"""
    if len(sys.argv) < 2:
        print("사용법: python hwp_analyzer.py <hwp_file_path>")
        print("예제: python hwp_analyzer.py test.hwp")
        sys.exit(1)

    hwp_file = sys.argv[1]

    try:
        with HWPAnalyzer(hwp_file) as analyzer:
            analyzer.full_analysis()
    except Exception as e:
        print(f"\n오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
