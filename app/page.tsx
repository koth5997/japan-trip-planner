"use client";

import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  Autocomplete,
} from "@react-google-maps/api";
import { useState, useRef, useEffect } from "react";
import { Trash2, Plus, Edit3, Save, MapPin, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

const mapContainerStyle = {
  width: "100%",
  height: "100vh",
};

const defaultCenter = {
  lat: 35.6804,
  lng: 139.769,
};

// 🚨 [중요 수정 1] libraries 배열을 컴포넌트 밖으로 뺐습니다.
// 이렇게 해야 지도가 계속 재로딩되는 것을 막을 수 있습니다.
type Library = "places"; // 타입 정의
const libraries: Library[] = ["places"];

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  memo: string;
  createdAt: number;
}
console.log("API Key 확인:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
export default function Home() {
  const { isLoaded } = useJsApiLoader({
    id: "japan-tripplan-places",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries, // 🚨 [중요 수정 2] 밖에서 만든 변수를 넣습니다.
  });

  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState(defaultCenter);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const [searchMarker, setSearchMarker] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    // 🔍 [디버깅용] DB 연결 확인 로그
    console.log("🔥 Firebase 연결 시도 중...");
    
    const q = query(collection(db, "places"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("✅ 데이터 수신됨! 개수:", snapshot.docs.length);
      const placesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Place[];
      setPlaces(placesData);
    });
    return () => unsubscribe();
  }, []);

  const onAutocompleteLoad = (ac: google.maps.places.Autocomplete) => {
    autocompleteRef.current = ac;
  };

  const onPlaceChanged = () => {
    if (!autocompleteRef.current || !map) return;
    try {
      const place = autocompleteRef.current.getPlace();
      if (!place.geometry || !place.geometry.location) {
        alert("장소 정보를 가져올 수 없습니다.");
        return;
      }

      const location = place.geometry.location;
      const lat = location.lat();
      const lng = location.lng();
      const name = place.name || "검색한 장소";

      map.panTo({ lat, lng });
      map.setZoom(15);
      setSelectedPlace({ lat, lng });
      setSearchMarker({ lat, lng, name });
    } catch (error) {
      console.error("검색 에러:", error);
    }
  };

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!isAddingMode || !e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    try {
      console.log("💾 저장 시도:", lat, lng);
      await addDoc(collection(db, "places"), {
        name: `새 장소`,
        lat: lat,
        lng: lng,
        memo: "",
        createdAt: Date.now(),
      });
      console.log("✅ 저장 성공!");
      setSelectedPlace({ lat, lng });
      setIsAddingMode(false);
    } catch (error) {
      console.error("❌ 저장 실패 Error: ", error);
      alert("저장에 실패했습니다. 콘솔을 확인해주세요.");
    }
  };

  const handleMemoChange = async (id: string, newMemo: string) => {
    setPlaces(places.map((p) => (p.id === id ? { ...p, memo: newMemo } : p)));
    const placeRef = doc(db, "places", id);
    // 에러 방지를 위해 try-catch 추가
    try {
      await updateDoc(placeRef, { memo: newMemo });
    } catch (e) {
      console.error("메모 저장 실패", e);
    }
  };

  const updateMemoOnBlur = async (id: string, memo: string) => {
    const placeRef = doc(db, "places", id);
    await updateDoc(placeRef, { memo: memo });
  };

  const handleNameChange = async (id: string, newName: string) => {
    const placeRef = doc(db, "places", id);
    await updateDoc(placeRef, { name: newName });
  };

  const deletePlace = async (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "places", id));
    }
  };

  const startEditName = (place: Place) => {
    setEditingName(place.id);
    setTempName(place.name);
  };

  const saveEditName = (id: string) => {
    if (tempName.trim()) {
      handleNameChange(id, tempName.trim());
    }
    setEditingName(null);
  };

  const focusPlaceOnMap = (lat: number, lng: number) => {
    setSelectedPlace({ lat, lng });
    if (map) {
      map.panTo({ lat, lng });
      map.setZoom(14);
    }
  };

  if (!isLoaded)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-50">
        로딩 중...
      </div>
    );

  return (
    <div className="h-screen w-full bg-slate-900 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <div className="mx-auto flex h-full max-w-7xl flex-row gap-4 px-4 py-4">
        {/* 왼쪽 패널 */}
        <div className="flex h-full w-[420px] min-w-[320px] flex-col rounded-3xl bg-white/90 shadow-2xl backdrop-blur">
          <div className="rounded-t-3xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-100">
              Family Trip Planner
            </p>
            <h1 className="mt-1 text-2xl font-bold">🇯🇵 도쿄 가족여행</h1>
            <p className="mt-1 text-xs text-indigo-100">
              Firebase 실시간 연동됨
            </p>
          </div>

          <div className="border-b bg-slate-50/80 px-4 pb-4 pt-3">
            <button
              onClick={() => setIsAddingMode(!isAddingMode)}
              className={`mb-2 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition-all ${
                isAddingMode
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600"
              }`}
            >
              {isAddingMode ? (
                <>❌ 취소</>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> 지도 클릭으로 추가
                </>
              )}
            </button>
            {isAddingMode && (
              <p className="animate-pulse text-center text-xs font-medium text-emerald-700">
                👉 오른쪽 지도를 클릭하세요!
              </p>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {places.map((place, index) => (
              <div
                key={place.id}
                className="group cursor-pointer rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"
                onClick={() => focusPlaceOnMap(place.lat, place.lng)}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                      {index + 1}
                    </span>
                    {editingName === place.id ? (
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={() => saveEditName(place.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditName(place.id);
                          if (e.key === "Escape") setEditingName(null);
                        }}
                        className="flex-1 rounded-lg border border-indigo-300 px-2 py-1 text-sm font-semibold text-slate-800"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 className="flex-1 text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
                        {place.name}
                      </h3>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editingName === place.id
                          ? saveEditName(place.id)
                          : startEditName(place);
                      }}
                      className="rounded-lg p-1.5 hover:bg-indigo-50"
                    >
                      {editingName === place.id ? (
                        <Save className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Edit3 className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlace(place.id);
                      }}
                      className="rounded-lg p-1.5 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>

                <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                  </span>
                </div>

                <textarea
                  className="mt-1 w-full resize-none rounded-xl border border-yellow-200 bg-yellow-50/80 p-3 text-xs text-slate-700 placeholder-slate-400 shadow-inner focus:border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  rows={3}
                  placeholder="메모..."
                  defaultValue={place.memo}
                  onBlur={(e) => updateMemoOnBlur(place.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽 지도 */}
        <div className="relative flex-1 overflow-hidden rounded-3xl border border-slate-800/40 shadow-[0_20px_45px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-xl">
              <Search className="h-4 w-4 text-slate-400" />
              {/* Autocomplete 컴포넌트가 구글 정책상 안 될 수도 있습니다. */}
              {/* 안 되면 일반 input으로 바꿔야 합니다. */}
              <Autocomplete
                onLoad={onAutocompleteLoad}
                onPlaceChanged={onPlaceChanged}
              >
                <input
                  type="text"
                  placeholder="장소 검색 (안되면 알려주세요)"
                  className="w-[320px] bg-transparent text-sm focus:outline-none"
                />
              </Autocomplete>
            </div>
          </div>

          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={selectedPlace}
            zoom={12}
            onLoad={setMap}
            onClick={handleMapClick}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              cursor: isAddingMode ? "crosshair" : "default",
              styles: [
                {
                  featureType: "poi",
                  elementType: "labels.icon",
                  stylers: [{ visibility: "off" }],
                },
              ],
            }}
          >
            {places.map((place, index) => (
              <MarkerF
                key={place.id}
                position={{ lat: place.lat, lng: place.lng }}
                label={{
                  text: String(index + 1),
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
                onClick={() => focusPlaceOnMap(place.lat, place.lng)}
                draggable={true}
              />
            ))}
            {searchMarker && <MarkerF position={searchMarker} />}
          </GoogleMap>
        </div>
      </div>
    </div>
  );
}