import { useState } from "react";
import { api, type AppSettings, type FsListResponse } from "../api/client";

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  hidden?: boolean;
}

export default function SettingsView({ settings, onSave, hidden }: Props) {
  const [explorer, setExplorer] = useState<FsListResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const openExplorer = async (path?: string) => {
    setErr(null);
    try {
      setExplorer(await api.explore(path));
    } catch (e) {
      setErr(String(e));
    }
  };

  const addFolder = (path: string) => {
    if (settings.scanFolders.includes(path)) return;
    onSave({ ...settings, scanFolders: [...settings.scanFolders, path] });
    setExplorer(null);
  };

  const removeFolder = (path: string) =>
    onSave({ ...settings, scanFolders: settings.scanFolders.filter((f) => f !== path) });

  return (
    <div className="settingsview" hidden={hidden}>
      <h2>설정</h2>
      {err && <div className="error">{err}</div>}

      {/* scan folders */}
      <section className="setting-block">
        <h3>스캔 폴더 (NAS)</h3>
        <p className="note">여기 추가한 폴더가 재생 라이브러리의 접근 경로가 됩니다.</p>
        <ul className="folder-list">
          {settings.scanFolders.map((f) => (
            <li key={f}>
              <span className="p">{f}</span>
              <button className="rm" onClick={() => removeFolder(f)}>
                제거
              </button>
            </li>
          ))}
          {!settings.scanFolders.length && <li className="hint">추가된 폴더가 없습니다.</li>}
        </ul>

        {explorer ? (
          <div className="explorer">
            <div className="crumb">{explorer.path || "(최상위)"}</div>
            <ul className="entries">
              {explorer.parent && (
                <li>
                  <button onClick={() => openExplorer(explorer.parent!)}>⬆ ..</button>
                </li>
              )}
              {explorer.entries.map((e) => (
                <li key={e.path}>
                  <button onClick={() => openExplorer(e.path)}>📁 {e.name}</button>
                </li>
              ))}
              {!explorer.entries.length && <li className="hint">하위 폴더 없음</li>}
            </ul>
            <div className="explorer-actions">
              {explorer.path && (
                <button className="add" onClick={() => addFolder(explorer.path)}>
                  ✓ 이 폴더 추가: {explorer.path}
                </button>
              )}
              <button onClick={() => setExplorer(null)}>닫기</button>
            </div>
          </div>
        ) : (
          <button className="browse" onClick={() => openExplorer()}>
            📂 폴더 찾아보기
          </button>
        )}
      </section>

      {/* preferences */}
      <section className="setting-block">
        <h3>재생 설정</h3>
        <label className="row">
          <span>기본 엔진</span>
          <select
            value={settings.defaultEngine}
            onChange={(e) => onSave({ ...settings, defaultEngine: e.target.value })}
          >
            <option value="real">Real 악기 HQ (SpessaSynth)</option>
            <option value="simple">일반 MIDI (html-midi-player)</option>
          </select>
        </label>
        <label className="row">
          <span>볼륨</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(e) => onSave({ ...settings, volume: Number(e.target.value) })}
          />
        </label>
        <label className="row">
          <span>BitMidi 온라인 검색</span>
          <input
            type="checkbox"
            checked={settings.bitmidiEnabled}
            onChange={(e) => onSave({ ...settings, bitmidiEnabled: e.target.checked })}
          />
        </label>
      </section>
    </div>
  );
}
