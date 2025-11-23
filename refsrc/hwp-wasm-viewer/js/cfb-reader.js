/**
 * CFB (Compound File Binary) Reader
 * HWP 파일의 복합 파일 구조를 읽기 위한 래퍼 클래스
 */

class CFBReader {
    constructor(arrayBuffer) {
        try {
            // CFB 라이브러리 확인
            if (typeof CFB === 'undefined') {
                throw new Error('CFB 라이브러리가 로드되지 않았습니다');
            }

            // ArrayBuffer를 Uint8Array로 변환
            const data = new Uint8Array(arrayBuffer);

            // CFB 라이브러리를 사용하여 파일 파싱
            this.cfb = CFB.read(data, { type: 'array' });
            this.entries = this.cfb.FileIndex;
        } catch (error) {
            console.error('CFB 파싱 상세 오류:', error);
            throw new Error('CFB 파일 파싱 실패: ' + error.message);
        }
    }

    /**
     * 스트림 목록 가져오기
     */
    listStreams() {
        return this.entries
            .filter(entry => entry.type === 2) // 2 = Stream
            .map(entry => entry.name);
    }

    /**
     * 스토리지 목록 가져오기
     */
    listStorages() {
        return this.entries
            .filter(entry => entry.type === 1) // 1 = Storage
            .map(entry => entry.name);
    }

    /**
     * 특정 스트림 읽기
     * @param {string} streamName - 스트림 이름 (예: "FileHeader", "DocInfo")
     * @returns {Uint8Array|null} 스트림 데이터
     */
    readStream(streamName) {
        try {
            const data = CFB.find(this.cfb, streamName);
            if (!data) {
                console.warn(`스트림을 찾을 수 없습니다: ${streamName}`);
                return null;
            }
            // content를 Uint8Array로 변환
            return new Uint8Array(data.content);
        } catch (error) {
            console.error(`스트림 읽기 실패 (${streamName}):`, error);
            return null;
        }
    }

    /**
     * 섹션 스트림 읽기 (BodyText/Section0, Section1... 또는 Section0, Section1...)
     * @param {number} sectionIndex - 섹션 번호
     * @returns {Uint8Array|null}
     */
    readSection(sectionIndex) {
        // 먼저 BodyText 스토리지 내부에서 찾기
        let data = this.readStream(`BodyText/Section${sectionIndex}`);

        // 없으면 루트에서 직접 찾기
        if (!data) {
            data = this.readStream(`Section${sectionIndex}`);
        }

        return data;
    }

    /**
     * 바이너리 데이터 읽기 (BinData/BIN000X.*)
     * @param {number} binId - 바이너리 ID
     * @returns {Uint8Array|null}
     */
    readBinaryData(binId) {
        const binName = `BIN${String(binId).padStart(4, '0')}`;
        // BinData 스토리지 내에서 해당 ID를 가진 스트림 찾기
        const streams = this.listStreams();
        const matchingStream = streams.find(name => name.includes(binName));

        if (matchingStream) {
            return this.readStream(matchingStream);
        }
        return null;
    }

    /**
     * 디버그: 파일 구조 출력
     */
    debugPrintStructure() {
        console.log('=== CFB File Structure ===');
        console.log('Storages:');
        this.listStorages().forEach(name => console.log(`  📁 ${name}`));
        console.log('\nStreams:');
        this.listStreams().forEach(name => console.log(`  📄 ${name}`));
    }

    /**
     * 파일 정보 가져오기
     */
    getFileInfo() {
        return {
            storageCount: this.listStorages().length,
            streamCount: this.listStreams().length,
            storages: this.listStorages(),
            streams: this.listStreams()
        };
    }
}
