import { jsx as _jsx } from "react/jsx-runtime";
// Windy.com embed widget for radar
function WindyRadar() {
    return (_jsx("div", { style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: '16px', overflow: 'hidden', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' }, children: _jsx("iframe", { title: "Windy.com Radar", width: "100%", height: "100%", style: { border: 'none', borderRadius: '16px', width: '100%', height: '100%' }, src: "https://embed.windy.com/embed2.html?lat=33.8485&lon=-83.2139&zoom=8&level=surface&overlay=radar&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=&detailLat=33.8485&detailLon=-83.2139&metricWind=default&metricTemp=default", allowFullScreen: true }) }));
}
export default WindyRadar;
