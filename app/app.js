/**
 * BIO-RESERVE Mobile Web Application
 * Smart Energy Management Model for Dairy Cattle Farm (Sei Temiang, Batam)
 * Inspired by Dribbble Clean IoT & Energy Dashboard Reference Designs
 */

(function () {
  'use strict';

  // --- Core Constants from Local Farm Research (Fitriyah dkk., 2018) ---
  const K_FACTOR = 0.6544; // Wh per Liter biogas (408.33 Wh / 624 L)
  const POWER_PUMP = 60; // W (Kritis)
  const POWER_CHILLER = 40; // W (Kritis)
  const POWER_LIGHT = 300; // W (Nonkritis)
  const POWER_FAN = 300; // W (Nonkritis)

  // --- Reactive System State ---
  const state = {
    tankCapacityLiters: 100, // Tangki uji 100 L (Skala Prototipe)
    currentGasLiters: 24.7, // Skenario ambang batas esai (SOC 24.7%)
    socThresholdPercent: 25.0,
    activeTab: 'pageDashboard',
    timeframe: 'live', // 'live' | 'day' | 'week'
    loads: {
      pump: true, // Kritis: Wajib ON (Interlock)
      chiller: true, // Kritis: Wajib ON (Interlock Pendingin Susu)
      light: false, // Nonkritis: Ditunda saat SOC <= 25%
      fan: false // Nonkritis: Ditunda saat SOC <= 25%
    },
    history: [], // Live 2-second real-time buffer
    pingMs: 24,
    activeHoverPt: null,
    notifFilter: 'all',
    notifications: [
      {
        id: 1,
        type: 'crit',
        category: 'crit',
        title: 'Ambang Kritis Tercapai (SOC 24.7%)',
        body: 'Relai SSR otomatis memutus beban lampu & kipas (600W). Alokasi energi difokuskan penuh untuk pompa air dan pendingin susu.',
        time: 'Baru saja',
        read: false
      },
      {
        id: 2,
        type: 'warn',
        category: 'crit',
        title: 'Konsumsi Melebihi Laju Produksi Biogas',
        body: 'Laju beban aktif melampaui kapasitas produksi harian digester biogas. Sistem mengalihkan daya ke beban prioritas kritis.',
        time: '14 mnt lalu',
        read: false
      },
      {
        id: 3,
        type: 'success',
        category: 'info',
        title: 'Beban Kritis Beroperasi Stabil',
        body: 'Pompa Air (60W) dan Pendingin Susu (40W) beroperasi normal pada tegangan AC 220V tanpa gangguan pasokan.',
        time: '42 mnt lalu',
        read: true
      },
      {
        id: 4,
        type: 'info',
        category: 'info',
        title: 'Node ESP32 & Relai SSR Terhubung',
        body: 'Modul sensor tekanan gas MPX5010DP, pembaca daya PZEM-004T, dan Relai SSR tersinkronisasi stabil ke dashboard telemetri.',
        time: '2 jam lalu',
        read: true
      }
    ]
  };

  // --- Historical Simulation Data for 24-Hour & 7-Day Modes ---
  const historicalData = {
    // 24-Hour Day Profile: Peternakan Sapi Perah Sei Temiang
    day: {
      hours: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '24:00'],
      // SOC % through 24h: subuh minum sapi -> turun ke 24.5% (shedding aktif) -> siang gas naik ke 68% -> sore perah susu -> malam stabil
      soc: [52.0, 48.5, 42.0, 24.5, 34.0, 52.0, 68.5, 64.0, 44.0, 38.0, 36.5, 35.0, 34.0],
      power: [100, 100, 100, 700, 100, 100, 100, 100, 400, 100, 100, 100, 100],
      sheddingActive: [false, false, false, true, false, false, false, false, false, false, false, false, false],
      stats: {
        bigStat: '46.5%',
        badge: 'Optimal',
        sub: 'Terjadi 1x shedding otomatis saat pemompaan subuh (06:14 WIB)',
        label1: 'Konsumsi Harian',
        val1: '2.14 kWh',
        label2: 'Waktu Kritis',
        val2: '100% Terlindungi',
        label3: 'Shedding Hemat',
        val3: '4.2 kWh (42%)'
      }
    },
    // 7-Day Weekly Aggregated Profile
    week: {
      days: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
      // Average Daily SOC %
      soc: [48.2, 54.6, 51.0, 47.8, 56.2, 52.4, 49.5],
      // Biogas Produced (Liters)
      biogasProd: [520, 545, 510, 490, 560, 535, 525],
      // Energy saved by load shedding (kWh)
      energySaved: [4.2, 4.0, 4.4, 4.6, 3.8, 4.1, 4.3],
      stats: {
        bigStat: '93.4%',
        badge: 'Efisiensi Tinggi',
        sub: 'Total 28.5 kWh beban nonkritis berhasil dialihkan saat cadangan menipis',
        label1: 'Total Biogas',
        val1: '3.685 L',
        label2: 'Pasokan Pompa',
        val2: '24/7 Aman',
        label3: 'Hemat Beban',
        val3: '28.5 kWh'
      }
    }
  };



  // --- DOM Elements Mapping ---
  const dom = {
    notifBtn: document.getElementById('notifBtn'),
    notifBadgeDot: document.getElementById('notifBadgeDot'),
    tabBadgeDot: document.getElementById('tabBadgeDot'),

    // Hero Blue Card
    heroCircleBar: document.getElementById('heroCircleBar'),
    heroSocNum: document.getElementById('heroSocNum'),
    heroStatusBadge: document.getElementById('heroStatusBadge'),
    heroEnergySub: document.getElementById('heroEnergySub'),
    heroMeaningSub: document.getElementById('heroMeaningSub'),
    heroDurationNum: document.getElementById('heroDurationNum'),
    heroDurationUnit: document.getElementById('heroDurationUnit'),
    heroDurationLoad: document.getElementById('heroDurationLoad'),
    heroFooterDot: document.getElementById('heroFooterDot'),

    // Power Stat & Quad Core Metrics Grid
    statWattsNum: document.getElementById('statWattsNum'),
    statPowerSub: document.getElementById('statPowerSub'),

    // 4 Core Metrics Explicit Bindings
    quadSocNum: document.getElementById('quadSocNum'),
    quadEnergyWh: document.getElementById('quadEnergyWh'),
    quadVolumeSub: document.getElementById('quadVolumeSub'),
    quadPressureChip: document.getElementById('quadPressureChip'),
    quadShedSavingsBadge: document.getElementById('quadShedSavingsBadge'),
    quadDurationBadge: document.getElementById('quadDurationBadge'),
    quadDurationVal: document.getElementById('quadDurationVal'),
    quadDurationUnit: document.getElementById('quadDurationUnit'),
    quadDurationSub: document.getElementById('quadDurationSub'),

    // Integrated Dashboard Live Chart Elements
    dashChartStatusPill: document.getElementById('dashChartStatusPill'),
    dashCanvas: document.getElementById('dashCanvas'),

    // Device Switches
    cardDeviceLight: document.getElementById('cardDeviceLight'),
    switchLight: document.getElementById('switchLight'),
    labelLightState: document.getElementById('labelLightState'),
    cardDeviceFan: document.getElementById('cardDeviceFan'),
    switchFan: document.getElementById('switchFan'),
    labelFanState: document.getElementById('labelFanState'),

    // Chart & Diagnostics
    chartTimeCaption: document.getElementById('chartTimeCaption'),
    chartTitleText: document.getElementById('chartTitleText'),
    chartLiveStatVal: document.getElementById('chartLiveStatVal'),
    chartStatBadge: document.getElementById('chartStatBadge'),
    chartStatSub: document.getElementById('chartStatSub'),
    smoothSplineCanvas: document.getElementById('smoothSplineCanvas'),
    chartTimeAxisLabels: document.getElementById('chartTimeAxisLabels'),
    legendLabelCurve: document.getElementById('legendLabelCurve'),
    legendUnitThreshold: document.getElementById('legendUnitThreshold'),

    summaryLabel1: document.getElementById('summaryLabel1'),
    summaryVal1: document.getElementById('summaryVal1'),
    summaryLabel2: document.getElementById('summaryLabel2'),
    summaryVal2: document.getElementById('summaryVal2'),
    summaryLabel3: document.getElementById('summaryLabel3'),
    summaryVal3: document.getElementById('summaryVal3'),


    // Hardware Telemetry Diagnostic Elements
    diagPressureVal: document.getElementById('diagPressureVal'),
    pressureBarFill: document.getElementById('pressureBarFill'),
    diagVolumeSub: document.getElementById('diagVolumeSub'),
    diagPressureStatus: document.getElementById('diagPressureStatus'),

    diagPowerNumber: document.getElementById('diagPowerNumber'),
    diagVoltVal: document.getElementById('diagVoltVal'),
    diagAmpsVal: document.getElementById('diagAmpsVal'),
    diagShedLabel: document.getElementById('diagShedLabel'),

    diagPingVal: document.getElementById('diagPingVal'),
    diagWifiRssi: document.getElementById('diagWifiRssi'),
    diagCpuLoad: document.getElementById('diagCpuLoad'),
    diagFreeHeap: document.getElementById('diagFreeHeap'),
    diagUptime: document.getElementById('diagUptime'),
    diagRelayClosedCount: document.getElementById('diagRelayClosedCount'),
    relayCh3Pill: document.getElementById('relayCh3Pill'),
    relayCh4Pill: document.getElementById('relayCh4Pill'),
    relayCh3State: document.getElementById('relayCh3State'),
    relayCh4State: document.getElementById('relayCh4State'),

    // Notifications
    notifListContainer: document.getElementById('notifListContainer'),
    floatingToastPill: document.getElementById('floatingToastPill')
  };

  // --- Mathematical Computation Engine ---
  function computeMetrics() {
    const V = Math.max(0, Math.min(state.currentGasLiters, state.tankCapacityLiters));
    const V_full = state.tankCapacityLiters;
    const soc = V_full > 0 ? (V / V_full) * 100 : 0;
    const energyWh = V * K_FACTOR;
    const totalEnergyWh = V_full * K_FACTOR;
    const isCritical = soc <= state.socThresholdPercent;

    // Load shedding rules
    if (isCritical) {
      state.loads.light = false;
      state.loads.fan = false;
    }

    let activePower = 0;
    if (state.loads.pump) activePower += POWER_PUMP;
    if (state.loads.chiller) activePower += POWER_CHILLER;
    if (state.loads.light) activePower += POWER_LIGHT;
    if (state.loads.fan) activePower += POWER_FAN;

    const effectivePower = Math.max(10, activePower);
    const durationHours = energyWh / effectivePower;
    const durationMinutes = durationHours * 60;
    const baseline700WMin = (energyWh / 700) * 60;

    return {
      V,
      V_full,
      soc,
      energyWh,
      totalEnergyWh,
      isCritical,
      activePower,
      durationHours,
      durationMinutes,
      baseline700WMin
    };
  }

  // --- Render UI ---
  function render() {
    const m = computeMetrics();

    // 1. Hero Blue Card Gauge (Radius 40 -> Circumference = 2 * PI * 40 ≈ 251.327)
    const circumference = 251.327;
    const offset = circumference - (m.soc / 100) * circumference;
    if (dom.heroCircleBar) {
      dom.heroCircleBar.style.strokeDashoffset = Math.max(0, Math.min(circumference, offset));
    }

    if (dom.heroSocNum) dom.heroSocNum.textContent = m.soc.toFixed(1);
    if (dom.heroEnergySub) {
      dom.heroEnergySub.textContent = `${m.energyWh.toFixed(1)} Wh dari ${m.totalEnergyWh.toFixed(1)} Wh`;
    }

    if (dom.heroStatusBadge) {
      if (m.isCritical) {
        dom.heroStatusBadge.textContent = 'MODE SHEDDING';
        if (dom.heroCircleBar) dom.heroCircleBar.style.stroke = '#fda4af';
      } else {
        dom.heroStatusBadge.textContent = 'MODE NORMAL';
        if (dom.heroCircleBar) dom.heroCircleBar.style.stroke = '#ffffff';
      }
    }

    // Duration Bubble
    if (dom.heroDurationNum && dom.heroDurationUnit) {
      if (m.durationHours >= 1) {
        dom.heroDurationNum.textContent = m.durationHours.toFixed(1);
        dom.heroDurationUnit.textContent = 'Jam';
      } else {
        dom.heroDurationNum.textContent = m.durationMinutes.toFixed(1);
        dom.heroDurationUnit.textContent = 'Menit';
      }
    }
    if (dom.heroDurationLoad) {
      dom.heroDurationLoad.textContent = `Beban ${m.activePower}W`;
    }

    // 2. Quick Stat Cards
    if (dom.statWattsNum) dom.statWattsNum.textContent = m.activePower;
    if (dom.statPowerSub) {
      if (m.activePower <= 100) {
        dom.statPowerSub.textContent = 'Hemat 600W (85.7% Shed)';
      } else if (m.activePower <= 400) {
        dom.statPowerSub.textContent = 'Beban separuh aktif';
      } else {
        dom.statPowerSub.textContent = 'Semua 4 beban menyala';
      }
    }

    const pressureKPa = ((m.V / m.V_full) * 10).toFixed(2);

    // 4 Core Metrics Explicit Quad Grid Values
    if (dom.quadSocNum) dom.quadSocNum.textContent = m.soc.toFixed(1);
    if (dom.quadEnergyWh) dom.quadEnergyWh.textContent = m.energyWh.toFixed(1);
    if (dom.quadVolumeSub) dom.quadVolumeSub.textContent = `Tekanan: ${pressureKPa} kPa (10 kPa \u2261 100 L)`;
    if (dom.quadPressureChip) dom.quadPressureChip.textContent = `${pressureKPa} kPa`;
    if (dom.quadShedSavingsBadge) {
      if (m.activePower <= 100) {
        dom.quadShedSavingsBadge.textContent = 'Hemat 85.7%';
      } else if (m.activePower <= 400) {
        dom.quadShedSavingsBadge.textContent = 'Hemat 42.8%';
      } else {
        dom.quadShedSavingsBadge.textContent = 'Beban Penuh';
      }
    }
    if (dom.quadDurationVal && dom.quadDurationUnit) {
      if (m.durationHours >= 1) {
        dom.quadDurationVal.textContent = m.durationHours.toFixed(1);
        dom.quadDurationUnit.textContent = 'Jam';
      } else {
        dom.quadDurationVal.textContent = m.durationMinutes.toFixed(1);
        dom.quadDurationUnit.textContent = 'Menit';
      }
    }
    if (dom.quadDurationBadge) {
      dom.quadDurationBadge.textContent = m.isCritical ? 'Kritis Terjaga' : 'Normal Stabil';
    }
    if (dom.quadDurationSub) {
      dom.quadDurationSub.textContent = m.activePower <= 100 ? 'Pompa & Pendingin Susu Aktif' : `${m.activePower}W Terkoneksi`;
    }

    // Dashboard Integrated Live Chart Status Pill
    if (dom.dashChartStatusPill) {
      dom.dashChartStatusPill.textContent = m.isCritical
        ? `SOC ${m.soc.toFixed(1)}% • Mode Shedding`
        : `SOC ${m.soc.toFixed(1)}% • Terkendali`;
      dom.dashChartStatusPill.style.color = m.isCritical ? '#d97706' : '#2563eb';
    }

    // 3. Device Switches
    if (dom.switchLight) dom.switchLight.checked = state.loads.light;
    if (dom.switchFan) dom.switchFan.checked = state.loads.fan;

    if (dom.cardDeviceLight && dom.labelLightState) {
      if (state.loads.light) {
        dom.cardDeviceLight.classList.remove('is-shedded');
        dom.labelLightState.textContent = 'Aktif';
        dom.labelLightState.className = 'relay-state-text text-blue';
      } else {
        dom.cardDeviceLight.classList.add('is-shedded');
        dom.labelLightState.textContent = 'Ditunda';
        dom.labelLightState.className = 'relay-state-text';
      }
    }

    if (dom.cardDeviceFan && dom.labelFanState) {
      if (state.loads.fan) {
        dom.cardDeviceFan.classList.remove('is-shedded');
        dom.labelFanState.textContent = 'Aktif';
        dom.labelFanState.className = 'relay-state-text text-blue';
      } else {
        dom.cardDeviceFan.classList.add('is-shedded');
        dom.labelFanState.textContent = 'Ditunda';
        dom.labelFanState.className = 'relay-state-text';
      }
    }

    // 4. Hardware Telemetry Card Updates
    if (dom.diagPressureVal) dom.diagPressureVal.textContent = pressureKPa;
    if (dom.pressureBarFill) dom.pressureBarFill.style.width = `${Math.min(100, (m.V / m.V_full) * 100)}%`;
    if (dom.diagVolumeSub) dom.diagVolumeSub.textContent = `${pressureKPa} kPa`;
    if (dom.diagPressureStatus) {
      if (m.isCritical) {
        dom.diagPressureStatus.textContent = `Ambang Kritis (${m.soc.toFixed(1)}%)`;
        dom.diagPressureStatus.className = 'text-amber';
      } else {
        dom.diagPressureStatus.textContent = `Cadangan Aman (${m.soc.toFixed(1)}%)`;
        dom.diagPressureStatus.className = 'text-emerald';
      }
    }

    if (dom.diagPowerNumber) dom.diagPowerNumber.textContent = m.activePower;
    const amps = (m.activePower / 220.4).toFixed(2);
    if (dom.diagAmpsVal) dom.diagAmpsVal.textContent = `${amps} A`;
    if (dom.diagVoltVal) dom.diagVoltVal.textContent = '220.4 V';

    // Fluctuate ping slightly for realism (22-28 ms)
    state.pingMs = Math.floor(23 + Math.random() * 5);
    if (dom.diagPingVal) dom.diagPingVal.textContent = state.pingMs;

    // Relay Channels Status
    let closedCount = 2; // CH1 and CH2 are always CLOSED
    if (state.loads.light) closedCount++;
    if (state.loads.fan) closedCount++;
    if (dom.diagRelayClosedCount) dom.diagRelayClosedCount.textContent = `${closedCount}/4`;

    if (dom.relayCh3Pill && dom.relayCh3State) {
      if (state.loads.light) {
        dom.relayCh3Pill.className = 'relay-ch-pill is-closed';
        dom.relayCh3State.textContent = 'CLOSED';
      } else {
        dom.relayCh3Pill.className = 'relay-ch-pill is-open';
        dom.relayCh3State.textContent = 'OPEN (SHED)';
      }
    }

    if (dom.relayCh4Pill && dom.relayCh4State) {
      if (state.loads.fan) {
        dom.relayCh4Pill.className = 'relay-ch-pill is-closed';
        dom.relayCh4State.textContent = 'CLOSED';
      } else {
        dom.relayCh4Pill.className = 'relay-ch-pill is-open';
        dom.relayCh4State.textContent = 'OPEN (SHED)';
      }
    }

    updateBadges();
  }

  // --- Dashboard Mini Real-Time Spline Chart Engine (Competition Poster Feature) ---
  function drawDashboardCanvas() {
    const dCanvas = dom.dashCanvas;
    if (!dCanvas) return;
    const dCtx = dCanvas.getContext('2d');
    if (!dCtx) return;

    const rect = dCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width || 360;
    const h = rect.height || 125;

    dCanvas.width = w * dpr;
    dCanvas.height = h * dpr;
    dCtx.resetTransform ? dCtx.resetTransform() : dCtx.setTransform(1, 0, 0, 1, 0, 0);
    dCtx.scale(dpr, dpr);

    dCtx.clearRect(0, 0, w, h);

    const padLeft = 32;
    const padRight = 14;
    const padTop = 14;
    const padBottom = 16;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    // Light grid lines (0%, 25%, 50%, 75%, 100%)
    dCtx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
    dCtx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      dCtx.beginPath();
      dCtx.moveTo(padLeft, y);
      dCtx.lineTo(w - padRight, y);
      dCtx.stroke();

      dCtx.fillStyle = '#94a3b8';
      dCtx.font = '9px "JetBrains Mono", monospace';
      dCtx.textAlign = 'right';
      dCtx.fillText(`${100 - i * 25}%`, padLeft - 5, y + 3);
    }

    // 25% Threshold dashed line
    const threshY = padTop + chartH * (1 - state.socThresholdPercent / 100);
    dCtx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
    dCtx.lineWidth = 1.2;
    dCtx.setLineDash([4, 4]);
    dCtx.beginPath();
    dCtx.moveTo(padLeft, threshY);
    dCtx.lineTo(w - padRight, threshY);
    dCtx.stroke();
    dCtx.setLineDash([]);

    dCtx.fillStyle = '#ef4444';
    dCtx.font = '8px "JetBrains Mono", monospace';
    dCtx.textAlign = 'right';
    dCtx.fillText('25% Ambang', w - padRight, threshY - 3);

    const data = state.history || [];
    if (data.length < 2) return;

    const points = [];
    for (let i = 0; i < data.length; i++) {
      const x = padLeft + (i / (data.length - 1)) * chartW;
      const norm = Math.max(0, Math.min(1, data[i] / 100));
      const y = padTop + chartH * (1 - norm);
      points.push({ x, y });
    }

    // Spline Area Gradient
    dCtx.save();
    dCtx.beginPath();
    dCtx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const cpX = (points[i].x + points[i + 1].x) / 2;
      dCtx.quadraticCurveTo(points[i].x, points[i].y, cpX, (points[i].y + points[i + 1].y) / 2);
    }
    dCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    dCtx.lineTo(points[points.length - 1].x, padTop + chartH);
    dCtx.lineTo(points[0].x, padTop + chartH);
    dCtx.closePath();

    const areaGrad = dCtx.createLinearGradient(0, padTop, 0, padTop + chartH);
    areaGrad.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
    areaGrad.addColorStop(1, 'rgba(37, 99, 235, 0.00)');
    dCtx.fillStyle = areaGrad;
    dCtx.fill();
    dCtx.restore();

    // Spline Curve Stroke
    dCtx.beginPath();
    dCtx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const cpX = (points[i].x + points[i + 1].x) / 2;
      dCtx.quadraticCurveTo(points[i].x, points[i].y, cpX, (points[i].y + points[i + 1].y) / 2);
    }
    dCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    dCtx.strokeStyle = '#2563eb';
    dCtx.lineWidth = 2.4;
    dCtx.lineCap = 'round';
    dCtx.lineJoin = 'round';
    dCtx.stroke();

    // Pulsing Head Point
    const head = points[points.length - 1];
    dCtx.fillStyle = 'rgba(37, 99, 235, 0.22)';
    dCtx.beginPath();
    dCtx.arc(head.x, head.y, 8, 0, Math.PI * 2);
    dCtx.fill();

    dCtx.fillStyle = '#ffffff';
    dCtx.beginPath();
    dCtx.arc(head.x, head.y, 4, 0, Math.PI * 2);
    dCtx.fill();

    dCtx.strokeStyle = '#2563eb';
    dCtx.lineWidth = 2;
    dCtx.stroke();
  }

  // --- Smooth Canvas Spline Chart Engine for Live, Hari, and Minggu ---
  const canvas = dom.smoothSplineCanvas;
  const ctx = canvas ? canvas.getContext('2d') : null;

  function initChartHistory() {
    state.history = [];
    let soc = 27.2;
    for (let i = 24; i >= 0; i--) {
      soc = Math.max(16, soc - (24 - i) * 0.08 + (Math.random() * 0.3 - 0.15));
      state.history.push(soc);
    }
  }

  function drawSplineChart() {
    if (!ctx || !canvas) return;

    // Handle HiDPI displays for ultra-crisp lines
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width || 380;
    const h = rect.height || 200;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const padLeft = 34;
    const padRight = 16;
    const padTop = 16;
    const padBottom = 22;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    // --- CASE 1: LIVE TIMEFRAME ---
    if (state.timeframe === 'live') {
      if (dom.chartTitleText) dom.chartTitleText.textContent = 'Grafik Penggunaan Energi';
      if (dom.chartLiveStatVal) dom.chartLiveStatVal.textContent = `${(state.history[state.history.length - 1] || 24.7).toFixed(1)}%`;
      if (dom.chartStatBadge) {
        const liveSoc = state.history[state.history.length - 1] || 24.7;
        const liveIsCrit = liveSoc <= state.socThresholdPercent;
        dom.chartStatBadge.textContent = liveIsCrit ? 'Mode Shedding' : 'Terkendali';
        dom.chartStatBadge.className = liveIsCrit ? 'stat-pill-red' : 'stat-pill-green';
      }
      if (dom.chartStatSub) dom.chartStatSub.textContent = 'Batas otomatis pemutus relay pada SOC 25.0%';
      if (dom.legendLabelCurve) dom.legendLabelCurve.textContent = 'Tren Cadangan SOC (%)';
      if (dom.legendUnitThreshold) dom.legendUnitThreshold.style.display = 'flex';

      if (dom.chartTimeAxisLabels) {
        dom.chartTimeAxisLabels.innerHTML = `
          <span>60s lalu</span>
          <span>45s</span>
          <span>30s</span>
          <span>15s</span>
          <span>Sekarang</span>
        `;
      }

      if (dom.summaryLabel1) dom.summaryLabel1.textContent = 'Laju Beban';
      if (dom.summaryVal1) dom.summaryVal1.textContent = `${dom.statWattsNum ? dom.statWattsNum.textContent : '100'} W`;
      if (dom.summaryLabel2) dom.summaryLabel2.textContent = 'Waktu Proteksi';
      if (dom.summaryVal2) dom.summaryVal2.textContent = '100% Aman';
      if (dom.summaryLabel3) dom.summaryLabel3.textContent = 'Hemat Beban';
      if (dom.summaryVal3) dom.summaryVal3.textContent = '600 Watt';

      drawGridAndCurve(state.history, padLeft, padRight, padTop, padBottom, chartW, chartH, w, h, true, true);
    }

    // --- CASE 2: HARI (24-HOUR) TIMEFRAME ---
    else if (state.timeframe === 'day') {
      const dayData = historicalData.day;
      if (dom.chartTitleText) dom.chartTitleText.textContent = 'Dinamika Cadangan Biogas';
      if (dom.chartLiveStatVal) dom.chartLiveStatVal.textContent = dayData.stats.bigStat;
      if (dom.chartStatBadge) {
        dom.chartStatBadge.textContent = dayData.stats.badge;
        dom.chartStatBadge.className = 'stat-pill-green';
      }
      if (dom.chartStatSub) dom.chartStatSub.textContent = dayData.stats.sub;
      if (dom.legendLabelCurve) dom.legendLabelCurve.textContent = 'Fluktuasi SOC 24 Jam (%)';
      if (dom.legendUnitThreshold) dom.legendUnitThreshold.style.display = 'flex';

      if (dom.chartTimeAxisLabels) {
        dom.chartTimeAxisLabels.innerHTML = `
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        `;
      }

      if (dom.summaryLabel1) dom.summaryLabel1.textContent = dayData.stats.label1;
      if (dom.summaryVal1) dom.summaryVal1.textContent = dayData.stats.val1;
      if (dom.summaryLabel2) dom.summaryLabel2.textContent = dayData.stats.label2;
      if (dom.summaryVal2) dom.summaryVal2.textContent = dayData.stats.val2;
      if (dom.summaryLabel3) dom.summaryLabel3.textContent = dayData.stats.label3;
      if (dom.summaryVal3) dom.summaryVal3.textContent = dayData.stats.val3;

      drawGridAndCurve(dayData.soc, padLeft, padRight, padTop, padBottom, chartW, chartH, w, h, true, false);
    }

    // --- CASE 3: MINGGU (7-DAY) TIMEFRAME ---
    else if (state.timeframe === 'week') {
      const weekData = historicalData.week;
      if (dom.chartTitleText) dom.chartTitleText.textContent = 'Tren Efisiensi & Produksi';
      if (dom.chartLiveStatVal) dom.chartLiveStatVal.textContent = weekData.stats.bigStat;
      if (dom.chartStatBadge) {
        dom.chartStatBadge.textContent = weekData.stats.badge;
        dom.chartStatBadge.className = 'stat-pill-green';
      }
      if (dom.chartStatSub) dom.chartStatSub.textContent = weekData.stats.sub;
      if (dom.legendLabelCurve) dom.legendLabelCurve.textContent = 'Rata-Rata SOC Harian (%)';
      if (dom.legendUnitThreshold) dom.legendUnitThreshold.style.display = 'flex';

      if (dom.chartTimeAxisLabels) {
        dom.chartTimeAxisLabels.innerHTML = weekData.days.map(d => `<span>${d}</span>`).join('');
      }

      if (dom.summaryLabel1) dom.summaryLabel1.textContent = weekData.stats.label1;
      if (dom.summaryVal1) dom.summaryVal1.textContent = weekData.stats.val1;
      if (dom.summaryLabel2) dom.summaryLabel2.textContent = weekData.stats.label2;
      if (dom.summaryVal2) dom.summaryVal2.textContent = weekData.stats.val2;
      if (dom.summaryLabel3) dom.summaryLabel3.textContent = weekData.stats.label3;
      if (dom.summaryVal3) dom.summaryVal3.textContent = weekData.stats.val3;

      drawWeeklyBarsAndSpline(weekData, padLeft, padRight, padTop, padBottom, chartW, chartH, w, h);
    }
  }

  // --- Helper to Draw Standard Grid and Spline Curve ---
  function drawGridAndCurve(data, padLeft, padRight, padTop, padBottom, chartW, chartH, w, h, showThreshold, isLive) {
    // Horizontal Grid Lines & Percent Labels
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${100 - i * 25}%`, padLeft - 6, y + 3);
    }

    // 25% Threshold Dashed Line
    if (showThreshold) {
      const threshY = padTop + chartH * (1 - state.socThresholdPercent / 100);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, threshY);
      ctx.lineTo(w - padRight, threshY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label at right edge
      ctx.fillStyle = '#f43f5e';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('25%', w - padRight - 22, threshY - 4);
    }

    if (!data || data.length < 2) return;

    const points = [];
    for (let i = 0; i < data.length; i++) {
      const x = padLeft + (i / (data.length - 1)) * chartW;
      const norm = Math.max(0, Math.min(1, data[i] / 100));
      const y = padTop + chartH * (1 - norm);
      points.push({ x, y });
    }

    // Smooth Bezier Curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const cpX = (points[i].x + points[i + 1].x) / 2;
      ctx.bezierCurveTo(cpX, points[i].y, cpX, points[i + 1].y, points[i + 1].x, points[i + 1].y);
    }

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Soft Gradient Area Fill
    const lastPt = points[points.length - 1];
    ctx.lineTo(lastPt.x, padTop + chartH);
    ctx.lineTo(points[0].x, padTop + chartH);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    areaGrad.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
    areaGrad.addColorStop(1, 'rgba(37, 99, 235, 0.01)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Data points & pulse
    if (isLive) {
      // Live pulsing marker on latest point
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } else {
      // Points on milestones
      points.forEach((pt, idx) => {
        if (idx % 2 === 0 || idx === points.length - 1) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#2563eb';
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
      });
    }

    // Crosshair Indicator & Active Marker (Matching Reference Image Usage History)
    if (state.activeHoverPt) {
      ctx.save();
      // Thin vertical guide line
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(state.activeHoverPt.x, padTop);
      ctx.lineTo(state.activeHoverPt.x, padTop + chartH);
      ctx.stroke();

      // Sleek hollow circle marker at intersection
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(state.activeHoverPt.x, state.activeHoverPt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#2563eb';
      ctx.stroke();

      // Tiny inner dot
      ctx.beginPath();
      ctx.arc(state.activeHoverPt.x, state.activeHoverPt.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Helper to Draw 7-Day Weekly Chart ---
  function drawWeeklyBarsAndSpline(weekData, padLeft, padRight, padTop, padBottom, chartW, chartH, w, h) {
    // Grid Lines
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${100 - i * 25}%`, padLeft - 6, y + 3);
    }

    // 25% Threshold Line
    const threshY = padTop + chartH * (1 - 0.25);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, threshY);
    ctx.lineTo(w - padRight, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    const numDays = weekData.days.length;
    const colW = chartW / numDays;
    const barW = Math.max(14, colW * 0.42);

    // Draw Subtle Column Bars for Biogas Production
    for (let i = 0; i < numDays; i++) {
      const centerX = padLeft + colW * i + colW / 2;
      const soc = weekData.soc[i];
      const norm = soc / 100;
      const barH = chartH * norm;
      const barY = padTop + chartH - barH;

      const barGrad = ctx.createLinearGradient(0, barY, 0, padTop + chartH);
      barGrad.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
      barGrad.addColorStop(1, 'rgba(37, 99, 235, 0.08)');
      ctx.fillStyle = barGrad;

      // Rounded top bar
      const radius = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - barW / 2, padTop + chartH);
      ctx.lineTo(centerX - barW / 2, barY + radius);
      ctx.quadraticCurveTo(centerX - barW / 2, barY, centerX - barW / 2 + radius, barY);
      ctx.lineTo(centerX + barW / 2 - radius, barY);
      ctx.quadraticCurveTo(centerX + barW / 2, barY, centerX + barW / 2, barY + radius);
      ctx.lineTo(centerX + barW / 2, padTop + chartH);
      ctx.closePath();
      ctx.fill();

      // Top value label
      ctx.fillStyle = '#2563eb';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${soc.toFixed(0)}%`, centerX, barY - 5);
    }

    // Connect top of bars with a sleek trend line
    const points = [];
    for (let i = 0; i < numDays; i++) {
      const x = padLeft + colW * i + colW / 2;
      const norm = weekData.soc[i] / 100;
      const y = padTop + chartH * (1 - norm);
      points.push({ x, y });
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const cpX = (points[i].x + points[i + 1].x) / 2;
      ctx.bezierCurveTo(cpX, points[i].y, cpX, points[i + 1].y, points[i + 1].x, points[i + 1].y);
    }
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    points.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#2563eb';
      ctx.stroke();
    });

    // Crosshair Indicator & Active Marker (Weekly View)
    if (state.activeHoverPt) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(state.activeHoverPt.x, padTop);
      ctx.lineTo(state.activeHoverPt.x, padTop + chartH);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(state.activeHoverPt.x, state.activeHoverPt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#2563eb';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(state.activeHoverPt.x, state.activeHoverPt.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Interactive Chart Tooltip (Binance/TradingView-Style Hover Inspection) ---
  const chartTooltip = document.getElementById('chartCryptoTooltip');
  const tooltipTime = document.getElementById('tooltipTime');
  const tooltipBadge = document.getElementById('tooltipBadge');
  const tooltipSoc = document.getElementById('tooltipSoc');
  const tooltipPower = document.getElementById('tooltipPower');
  const tooltipVolume = document.getElementById('tooltipVolume');
  const tooltipExtraNote = document.getElementById('tooltipExtraNote');

  function handleChartInteraction(clientX, clientY) {
    if (!canvas || !chartTooltip) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const w = rect.width;
    const h = rect.height;

    const padLeft = 34;
    const padRight = 16;
    const padTop = 16;
    const padBottom = 22;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const relX = Math.max(0, Math.min(chartW, x - padLeft));
    const ratio = relX / chartW;

    let ptX = x;
    let ptY = h / 2;

    if (state.timeframe === 'live') {
      const dataLen = state.history.length;
      if (dataLen < 2) return;
      const idx = Math.min(dataLen - 1, Math.max(0, Math.round(ratio * (dataLen - 1))));
      const soc = state.history[idx] || 24.7;
      const secsAgo = Math.round((dataLen - 1 - idx) * 2.4);
      const m = computeMetrics();

      ptX = padLeft + (chartW / (dataLen - 1)) * idx;
      ptY = padTop + chartH * (1 - Math.min(100, Math.max(0, soc)) / 100);

      const now = new Date();
      now.setSeconds(now.getSeconds() - secsAgo);
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (tooltipTime) tooltipTime.textContent = `${timeStr} WIB`;
      if (tooltipSoc) tooltipSoc.textContent = `${soc.toFixed(1)}%`;
      if (tooltipPower) tooltipPower.textContent = `${m.activePower} W`;
      const vol = (soc / 100) * state.tankCapacityLiters;
      if (tooltipVolume) tooltipVolume.textContent = `${vol.toFixed(1)} L`;

      const isShed = soc <= state.socThresholdPercent;
      if (tooltipBadge) {
        tooltipBadge.textContent = isShed ? 'Shedding' : 'Normal';
        tooltipBadge.className = `crypto-tt-badge ${isShed ? 'badge-shedding' : 'badge-normal'}`;
      }
      if (tooltipExtraNote) tooltipExtraNote.textContent = isShed ? 'Mode Kritis Terjaga (Shedding Aktif)' : 'Pasokan stabil, beban terkendali';

    } else if (state.timeframe === 'day') {
      const dayData = historicalData.day;
      const dataLen = dayData.soc.length;
      const idx = Math.min(dataLen - 1, Math.max(0, Math.round(ratio * (dataLen - 1))));
      const soc = dayData.soc[idx] || 50;
      const power = dayData.power[idx] || 100;
      const isShed = dayData.sheddingActive[idx] || false;

      ptX = padLeft + (chartW / (dataLen - 1)) * idx;
      ptY = padTop + chartH * (1 - Math.min(100, Math.max(0, soc)) / 100);

      if (tooltipTime) tooltipTime.textContent = `${dayData.hours[idx]} WIB`;
      if (tooltipSoc) tooltipSoc.textContent = `${soc.toFixed(1)}%`;
      if (tooltipPower) tooltipPower.textContent = `${power} W`;
      const vol = (soc / 100) * state.tankCapacityLiters;
      if (tooltipVolume) tooltipVolume.textContent = `${vol.toFixed(1)} L`;
      if (tooltipBadge) {
        tooltipBadge.textContent = isShed ? 'Shedding' : 'Normal';
        tooltipBadge.className = `crypto-tt-badge ${isShed ? 'badge-shedding' : 'badge-normal'}`;
      }
      if (tooltipExtraNote) tooltipExtraNote.textContent = isShed ? 'Shedding aktif (beban 700W > ambang SOC)' : 'Cadangan dalam rentang aman';

    } else if (state.timeframe === 'week') {
      const weekData = historicalData.week;
      const numDays = weekData.days.length;
      const idx = Math.min(numDays - 1, Math.max(0, Math.round(ratio * (numDays - 1))));
      const soc = weekData.soc[idx] || 50;
      const biogas = weekData.biogasProd[idx] || 520;
      const saved = weekData.energySaved[idx] || 4.0;

      const colW = chartW / numDays;
      ptX = padLeft + colW * idx + colW / 2;
      ptY = padTop + chartH * (1 - Math.min(100, Math.max(0, soc)) / 100);

      if (tooltipTime) tooltipTime.textContent = `${weekData.days[idx]} • Agregasi Harian`;
      if (tooltipSoc) tooltipSoc.textContent = `${soc.toFixed(1)}%`;
      if (tooltipPower) tooltipPower.textContent = `${biogas} L`;
      if (tooltipVolume) tooltipVolume.textContent = `${saved.toFixed(1)} kWh`;
      if (tooltipBadge) {
        tooltipBadge.textContent = soc > 40 ? 'Optimal' : 'Rendah';
        tooltipBadge.className = `crypto-tt-badge ${soc > 40 ? 'badge-normal' : 'badge-shedding'}`;
      }
      if (tooltipExtraNote) tooltipExtraNote.textContent = `Produksi biogas ${biogas} L • Hemat ${saved.toFixed(1)} kWh`;
    }

    state.activeHoverPt = { x: ptX, y: ptY };
    
    // Smart flip tooltip so it never blocks the cursor or active point
    // Dynamic centered placement right above vertical crosshair (Matching Reference Image)
    const ttWidth = 140;
    const clampedX = Math.max(8, Math.min(w - ttWidth - 8, ptX - ttWidth / 2));
    chartTooltip.style.left = `${clampedX}px`;
    chartTooltip.style.right = 'auto';
    chartTooltip.style.top = '10px';

    chartTooltip.classList.add('active');
    drawSplineChart();
  }

  function hideChartTooltip() {
    state.activeHoverPt = null;
    if (chartTooltip) chartTooltip.classList.remove('active');
    drawSplineChart();
  }

  if (canvas) {
    canvas.addEventListener('mousemove', (e) => {
      handleChartInteraction(e.clientX, e.clientY);
    });

    canvas.addEventListener('click', (e) => {
      handleChartInteraction(e.clientX, e.clientY);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleChartInteraction(touch.clientX, touch.clientY);
    }, { passive: false });

    canvas.addEventListener('mouseleave', hideChartTooltip);
    canvas.addEventListener('touchend', () => {
      setTimeout(hideChartTooltip, 2400);
    });
  }

  function liveTick() {
    const m = computeMetrics();
    // Realistic micro-consumption per tick
    const consumedLiters = (m.activePower / 3600 / K_FACTOR) * 0.04;
    state.currentGasLiters = Math.max(0, state.currentGasLiters - consumedLiters);

    state.history.push(m.soc);
    if (state.history.length > 25) state.history.shift();

    // ESP32 telemetry live simulation
    if (!state._startTime) state._startTime = Date.now();
    const uptimeSec = Math.floor((Date.now() - state._startTime) / 1000);
    const uptimeMin = Math.floor(uptimeSec / 60);
    const uptimeHr = Math.floor(uptimeMin / 60);
    const uptimeDay = Math.floor(uptimeHr / 24);
    const uptimeStr = `${uptimeDay}d ${uptimeHr % 24}h ${uptimeMin % 60}m`;

    const rssi = -68 + Math.round((Math.random() - 0.5) * 4);
    const cpu = Math.round(10 + Math.random() * 6);
    const heap = Math.round(215 + Math.random() * 8);

    if (dom.diagWifiRssi) dom.diagWifiRssi.textContent = `${rssi} dBm`;
    if (dom.diagCpuLoad) dom.diagCpuLoad.textContent = `${cpu} %`;
    if (dom.diagFreeHeap) dom.diagFreeHeap.textContent = `${heap} KB`;
    if (dom.diagUptime) dom.diagUptime.textContent = uptimeStr;

    render();
    drawDashboardCanvas();

    // ONLY redraw canvas if user is actively watching 'live' timeframe!
    // This completely fixes the issue where 'Hari' and 'Minggu' were getting disrupted or overwritten!
    if (state.timeframe === 'live') {
      drawSplineChart();
    }
  }


  // --- Notifications ---
  function updateBadges() {
    const unread = state.notifications.filter(n => !n.read).length;
    if (unread > 0) {
      if (dom.notifBadgeDot) dom.notifBadgeDot.classList.add('active');
      if (dom.tabBadgeDot) dom.tabBadgeDot.classList.add('active');
    } else {
      if (dom.notifBadgeDot) dom.notifBadgeDot.classList.remove('active');
      if (dom.tabBadgeDot) dom.tabBadgeDot.classList.remove('active');
    }
  }

  function getNotifIconSvg(type) {
    switch (type) {
      case 'crit':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>`;
      case 'warn':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
      case 'success':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>`;
      case 'info':
      default:
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>`;
    }
  }

  function updateNotifCounts() {
    const total = state.notifications.length;
    const crit = state.notifications.filter(n => n.category === 'crit').length;
    const info = state.notifications.filter(n => n.category === 'info').length;

    const elAll = document.getElementById('notifCountAll');
    const elCrit = document.getElementById('notifCountCrit');
    const elInfo = document.getElementById('notifCountInfo');

    if (elAll) elAll.textContent = total;
    if (elCrit) elCrit.textContent = crit;
    if (elInfo) elInfo.textContent = info;
  }

  function renderNotifList() {
    updateNotifCounts();
    if (!dom.notifListContainer) return;
    dom.notifListContainer.innerHTML = '';

    const filtered = state.notifications.filter(item => {
      if (state.notifFilter === 'all') return true;
      return item.category === state.notifFilter;
    });

    if (filtered.length === 0) {
      dom.notifListContainer.innerHTML = `
        <div class="notif-empty-state">
          <div class="notif-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <span class="notif-empty-title">Tidak Ada Notifikasi</span>
          <span class="notif-empty-sub">Kategori ini tidak memiliki riwayat peringatan atau sistem saat ini.</span>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = `notif-toast-card status-${item.type} ${item.read ? 'is-read' : 'is-unread'}`;
      card.innerHTML = `
        <div class="notif-icon-box" title="${item.type.toUpperCase()}">
          ${getNotifIconSvg(item.type)}
        </div>
        <div class="notif-content-area">
          <div class="notif-meta-row">
            <div class="notif-title-wrap">
              ${!item.read ? '<span class="unread-purple-dot" title="Belum Dibaca"></span>' : ''}
              <span class="notif-card-title">${item.title}</span>
            </div>
            <span class="notif-time-badge">${item.time}</span>
          </div>
          <p class="notif-card-desc">${item.body}</p>
        </div>
        <button class="notif-dismiss-btn" data-id="${item.id}" title="Hapus Notifikasi" aria-label="Tutup">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      // Tombol hapus / dismiss
      const dismissBtn = card.querySelector('.notif-dismiss-btn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.notifications = state.notifications.filter(n => n.id !== item.id);
          renderNotifList();
          updateBadges();
          showToast('Notifikasi dihapus');
        });
      }

      // Klik card menandai notifikasi dibaca
      card.addEventListener('click', () => {
        if (!item.read) {
          item.read = true;
          renderNotifList();
          updateBadges();
        }
      });

      dom.notifListContainer.appendChild(card);
    });
  }

  function showToast(text) {
    if (!dom.floatingToastPill) return;
    dom.floatingToastPill.textContent = text;
    dom.floatingToastPill.classList.add('show');
    setTimeout(() => {
      dom.floatingToastPill.classList.remove('show');
    }, 3200);
  }

  // --- Category Tabs Filter ---
  function setupCategoryFilter() {
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const cat = pill.dataset.category;
        const deviceItems = document.querySelectorAll('.device-card-item');

        if (cat === 'all') {
          deviceItems.forEach(item => (item.style.display = 'flex'));
        } else if (cat === 'critical') {
          deviceItems.forEach(item => {
            item.style.display = item.dataset.category === 'critical' ? 'flex' : 'none';
          });
        } else if (cat === 'noncritical') {
          deviceItems.forEach(item => {
            item.style.display = item.dataset.category === 'noncritical' ? 'flex' : 'none';
          });
        }
      });
    });
  }

  // --- Events Setup ---
  function setupEvents() {
    setupCategoryFilter();

    // Curved Bottom Dock Navigation
    document.querySelectorAll('.dock-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        document.querySelectorAll('.dock-item-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPage = document.getElementById(targetId);
        if (targetPage) targetPage.classList.add('active');

        // Sembunyikan bell saat di halaman alarm/notifikasi & otomatis tandai telah dibaca
        if (targetId === 'pageNotifications') {
          if (dom.notifBtn) dom.notifBtn.style.display = 'none';
          state.notifications.forEach(n => (n.read = true));
          updateBadges();
          renderNotifList();
        } else {
          if (dom.notifBtn) dom.notifBtn.style.display = '';
        }

        if (targetId === 'pageDashboard') {
          setTimeout(drawDashboardCanvas, 60);
        } else if (targetId === 'pageAnalytics') {
          setTimeout(drawSplineChart, 60);
        }
      });
    });

    // Top Bell Shortcut
    if (dom.notifBtn) {
      dom.notifBtn.addEventListener('click', () => {
        const notifTab = document.querySelector('[data-target="pageNotifications"]');
        if (notifTab) notifTab.click();
      });
    }

    // Device Switches
    if (dom.switchLight) {
      dom.switchLight.addEventListener('change', (e) => {
        state.loads.light = e.target.checked;
        render();
        drawSplineChart();
      });
    }

    if (dom.switchFan) {
      dom.switchFan.addEventListener('change', (e) => {
        state.loads.fan = e.target.checked;
        render();
        drawSplineChart();
      });
    }

    // Timeframe Pills (Live, Hari, Minggu)
    document.querySelectorAll('.time-tab').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        document.querySelectorAll('.time-tab').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        state.timeframe = btn.dataset.range;
        state.activeHoverPt = null;
        if (chartTooltip) chartTooltip.classList.remove('active');
        drawSplineChart();
      });
    });


    // Notification Segmented Filter Pills
    document.querySelectorAll('.notif-seg-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.notif-seg-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.notifFilter = pill.dataset.filter;
        renderNotifList();
      });
    });


    // Window Resize Handling for Chart Canvases
    window.addEventListener('resize', () => {
      drawDashboardCanvas();
      drawSplineChart();
    });
  }

  // --- Initialization ---
  function init() {
    initChartHistory();
    renderNotifList();
    setupEvents();
    render();
    drawDashboardCanvas();
    drawSplineChart();

    // 2-second background simulation loop
    setInterval(liveTick, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
