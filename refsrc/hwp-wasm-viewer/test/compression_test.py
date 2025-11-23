#!/usr/bin/env python3
"""
HWP 압축 테스트 도구
다양한 압축 해제 방법을 시도하여 최적의 방법 찾기
"""

import olefile
import struct
import zlib
import sys


def try_decompress_methods(data, method_name):
    """다양한 압축 해제 방법 시도"""
    results = []

    # Method 1: raw deflate (windowBits=-15)
    try:
        decompressed = zlib.decompress(data, -15)
        results.append({
            'method': f'{method_name} - raw deflate (-15)',
            'success': True,
            'original_size': len(data),
            'decompressed_size': len(decompressed),
            'ratio': len(decompressed) / len(data) if len(data) > 0 else 0,
            'preview': decompressed[:50].hex()
        })
    except Exception as e:
        results.append({
            'method': f'{method_name} - raw deflate (-15)',
            'success': False,
            'error': str(e)
        })

    # Method 2: zlib with default windowBits
    try:
        decompressed = zlib.decompress(data)
        results.append({
            'method': f'{method_name} - zlib default',
            'success': True,
            'original_size': len(data),
            'decompressed_size': len(decompressed),
            'ratio': len(decompressed) / len(data) if len(data) > 0 else 0,
            'preview': decompressed[:50].hex()
        })
    except Exception as e:
        results.append({
            'method': f'{method_name} - zlib default',
            'success': False,
            'error': str(e)
        })

    # Method 3: zlib with gzip format (windowBits=15+16)
    try:
        decompressed = zlib.decompress(data, 15 + 16)
        results.append({
            'method': f'{method_name} - gzip format',
            'success': True,
            'original_size': len(data),
            'decompressed_size': len(decompressed),
            'ratio': len(decompressed) / len(data) if len(data) > 0 else 0,
            'preview': decompressed[:50].hex()
        })
    except Exception as e:
        results.append({
            'method': f'{method_name} - gzip format',
            'success': False,
            'error': str(e)
        })

    # Method 4: 스트림 전체를 먼저 압축 해제하는 방법
    # (이미 전달된 data가 일부이므로 여기서는 생략)

    return results


def test_stream_compression(ole, stream_name):
    """스트림 전체의 압축 해제 테스트"""
    print(f"\n{'='*70}")
    print(f"Testing: {stream_name}")
    print(f"{'='*70}")

    try:
        data = ole.openstream(stream_name).read()
    except:
        print(f"스트림을 찾을 수 없습니다: {stream_name}")
        return

    print(f"원본 크기: {len(data)} bytes")
    print(f"첫 16바이트: {data[:16].hex()}")

    # 전체 스트림 압축 해제 시도
    print(f"\n--- 전체 스트림 압축 해제 시도 ---")
    results = try_decompress_methods(data, 'Full Stream')

    for result in results:
        if result['success']:
            print(f"✅ {result['method']}")
            print(f"   압축 전: {result['original_size']} bytes")
            print(f"   압축 후: {result['decompressed_size']} bytes")
            print(f"   압축률: {result['ratio']:.2f}x")
            print(f"   미리보기: {result['preview'][:40]}...")
        else:
            print(f"❌ {result['method']}: {result['error']}")


def test_record_compression(ole, stream_name):
    """레코드 단위 압축 해제 테스트"""
    print(f"\n{'='*70}")
    print(f"Testing Records: {stream_name}")
    print(f"{'='*70}")

    try:
        data = ole.openstream(stream_name).read()
    except:
        print(f"스트림을 찾을 수 없습니다: {stream_name}")
        return

    offset = 0
    record_num = 0

    while offset < len(data) - 4 and record_num < 5:  # 처음 5개만
        try:
            # 레코드 헤더
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
                print(f"\n레코드 {record_num}: TagID=0x{tag_id:03x}, Size={size} - 범위 초과")
                break

            record_data = data[offset:offset+size]
            offset += size

            print(f"\n--- 레코드 {record_num} ---")
            print(f"TagID: 0x{tag_id:03x}, Level: {level}, Size: {size}")
            print(f"첫 16바이트: {record_data[:16].hex()}")

            # 압축 해제 시도
            results = try_decompress_methods(record_data, f'Record {record_num}')

            for result in results:
                if result['success']:
                    print(f"  ✅ {result['method']}: {result['decompressed_size']} bytes")
                else:
                    print(f"  ❌ {result['method']}: {result['error'][:50]}")

            record_num += 1

        except Exception as e:
            print(f"레코드 파싱 오류: {e}")
            break

    print(f"\n총 {record_num}개 레코드 테스트 완료")


def analyze_compression_pattern(ole):
    """압축 패턴 분석"""
    print(f"\n{'='*70}")
    print("압축 패턴 분석")
    print(f"{'='*70}")

    streams_to_test = ['DocInfo', 'BodyText/Section0']

    for stream_name in streams_to_test:
        try:
            data = ole.openstream(stream_name.split('/')).read()

            print(f"\n{stream_name}:")
            print(f"  크기: {len(data)} bytes")

            # 데이터 패턴 확인
            # zlib 압축 데이터는 0x78로 시작하는 경우가 많음
            if len(data) >= 2:
                first_two = data[:2]
                print(f"  첫 2바이트: 0x{first_two.hex()}")

                if first_two[0] == 0x78:
                    print(f"  ⚠️  zlib 매직 넘버 감지 (0x78)")

                    cmf = first_two[0]
                    flg = first_two[1]
                    compression_method = cmf & 0x0F
                    compression_info = (cmf >> 4) & 0x0F

                    print(f"     Compression Method: {compression_method}")
                    print(f"     Compression Info: {compression_info}")
                    print(f"     FLG: {flg}")

            # 엔트로피 간단 계산 (압축 여부 추정)
            byte_counts = {}
            for byte in data[:1000]:  # 처음 1000바이트만
                byte_counts[byte] = byte_counts.get(byte, 0) + 1

            unique_bytes = len(byte_counts)
            print(f"  유니크 바이트 수 (처음 1KB): {unique_bytes}/256")

            if unique_bytes < 100:
                print(f"  → 낮은 엔트로피: 압축되지 않았거나 단순한 데이터")
            elif unique_bytes > 200:
                print(f"  → 높은 엔트로피: 압축되었을 가능성 높음")

        except Exception as e:
            print(f"{stream_name}: 오류 - {e}")


def main():
    if len(sys.argv) < 2:
        print("사용법: python compression_test.py <hwp_file>")
        sys.exit(1)

    hwp_file = sys.argv[1]

    try:
        ole = olefile.OleFileIO(hwp_file)

        print("="*70)
        print("HWP 압축 테스트 도구")
        print("="*70)
        print(f"파일: {hwp_file}")

        # FileHeader에서 압축 플래그 확인
        header_data = ole.openstream('FileHeader').read()
        flags = struct.unpack('<I', header_data[36:40])[0]
        compressed = bool(flags & 0x01)

        print(f"압축 플래그: {'압축됨' if compressed else '압축되지 않음'} (0x{flags:08x})")

        # 1. 압축 패턴 분석
        analyze_compression_pattern(ole)

        # 2. 전체 스트림 압축 테스트
        test_stream_compression(ole, 'DocInfo')

        # 3. 레코드 단위 압축 테스트
        test_record_compression(ole, 'DocInfo')

        # 4. Section 테스트
        test_stream_compression(ole, 'BodyText/Section0')
        test_record_compression(ole, 'BodyText/Section0')

        ole.close()

    except Exception as e:
        print(f"오류: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
