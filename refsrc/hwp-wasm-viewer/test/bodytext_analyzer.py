#!/usr/bin/env python3
"""
BodyText 상세 분석기
BodyText 섹션을 압축 해제하고 모든 가능한 방법으로 텍스트 추출 시도
"""

import struct
import sys
import olefile
import zlib


def analyze_bodytext(hwp_file):
    ole = olefile.OleFileIO(hwp_file)

    # FileHeader에서 압축 플래그 확인
    header_data = ole.openstream('FileHeader').read()
    flags = struct.unpack('<I', header_data[36:40])[0]
    is_compressed = bool(flags & 0x01)

    print(f"압축 여부: {is_compressed}")

    # BodyText/Section0 읽기
    section_data = ole.openstream(['BodyText', 'Section0']).read()
    print(f"\n원본 크기: {len(section_data)} bytes")
    print(f"첫 16바이트: {section_data[:16].hex(' ')}")

    if is_compressed:
        # 압축 해제 시도
        try:
            decompressed = zlib.decompress(section_data, -15)
            print(f"\n✅ 압축 해제 성공 (raw deflate)")
            print(f"압축 해제 후 크기: {len(decompressed)} bytes")
            section_data = decompressed
        except:
            try:
                decompressed = zlib.decompress(section_data)
                print(f"\n✅ 압축 해제 성공 (zlib)")
                print(f"압축 해제 후 크기: {len(decompressed)} bytes")
                section_data = decompressed
            except Exception as e:
                print(f"\n❌ 압축 해제 실패: {e}")

    print(f"\n압축 해제 후 첫 64바이트:")
    for i in range(0, min(64, len(section_data)), 16):
        hex_part = ' '.join(f'{b:02x}' for b in section_data[i:i+16])
        ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in section_data[i:i+16])
        print(f"{i:04x}: {hex_part:<48} {ascii_part}")

    # 레코드 파싱
    print(f"\n\n레코드 파싱:")
    print("=" * 70)

    offset = 0
    record_num = 0

    TAG_NAMES = {
        0x42: 'LIST_HEADER',
        0x43: 'PAGE_DEF',
        0x44: 'FOOTNOTE_SHAPE',
        0x47: 'PAGE_BORDER_FILL',
        0x49: 'SHAPE_COMPONENT',
        0x50: 'PARA_HEADER',
        0x51: 'PARA_TEXT',
    }

    while offset < len(section_data) - 4:
        header = struct.unpack('<I', section_data[offset:offset+4])[0]
        offset += 4

        tag_id = header & 0x3FF
        level = (header >> 10) & 0x3FF
        size = (header >> 20) & 0xFFF

        if size == 0xFFF:
            if offset + 4 > len(section_data):
                break
            size = struct.unpack('<I', section_data[offset:offset+4])[0]
            offset += 4

        if offset + size > len(section_data):
            print(f"\n[레코드 {record_num}] 크기 초과로 중단")
            break

        record_data = section_data[offset:offset+size]
        offset += size

        tag_name = TAG_NAMES.get(tag_id, f'0x{tag_id:02x}')

        print(f"\n[레코드 {record_num}] Tag: {tag_name} (0x{tag_id:02x}), Level: {level}, Size: {size}")

        # PARA_TEXT인 경우 텍스트 추출 시도
        if tag_id == 0x51:
            try:
                text = record_data.decode('utf-16le', errors='ignore')
                clean = ''.join(c for c in text if ord(c) >= 32 or c in '\n\t')
                print(f"  📝 텍스트: \"{clean[:100]}{'...' if len(clean) > 100 else ''}\"")
            except:
                print(f"  ⚠️ UTF-16LE 디코딩 실패")

        # 모든 레코드에서 UTF-16LE 텍스트 시도
        else:
            try:
                text = record_data.decode('utf-16le', errors='strict')
                printable = sum(1 for c in text[:50] if ord(c) >= 32 or c in '\n\t')
                if printable / min(len(text), 50) > 0.7 and len(text) > 15:
                    clean = ''.join(c for c in text if ord(c) >= 32 or c in '\n\t')
                    print(f"  💡 가능한 텍스트: \"{clean[:80]}{'...' if len(clean) > 80 else ''}\"")
            except:
                pass

        # 처음 32바이트 hex dump
        if size > 0:
            preview = record_data[:min(32, size)]
            print(f"  데이터: {preview.hex(' ')}")

        record_num += 1

        if record_num > 20:  # 최대 20개 레코드만
            print("\n... (나머지 레코드 생략)")
            break

    ole.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("사용법: python bodytext_analyzer.py <hwp_file>")
        sys.exit(1)

    analyze_bodytext(sys.argv[1])
