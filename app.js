// State management
let rawData = [];
let groupedData = {};
let comparisonChart = null;

// DOM Elements
const districtSelect = document.getElementById('district-select');
const dongSelect = document.getElementById('dong-select');
const buildingSelect = document.getElementById('building-select');

const resultSection = document.getElementById('result-section');
const placeholderSection = document.getElementById('placeholder-section');
const statusBadge = document.getElementById('data-status-badge');

// Result DOM Elements
const resCgg = document.getElementById('res-cgg');
const resStdg = document.getElementById('res-stdg');
const resBldg = document.getElementById('res-bldg');

const resAvgEok = document.getElementById('res-avg-eok');
const resAvgMan = document.getElementById('res-avg-man');
const resCount = document.getElementById('res-count');
const resMedian = document.getElementById('res-median');
const resMin = document.getElementById('res-min');
const resMax = document.getElementById('res-max');
const resArea = document.getElementById('res-area');
const resPyung = document.getElementById('res-pyung');

const chartLocationName = document.getElementById('chart-location-name');
const typeListContainer = document.getElementById('type-list-container');
const districtOverviewGrid = document.getElementById('district-overview-grid');

// Helper: Format ten-thousand won (만원) into Korean Eok (억) & Man (만원)
function formatEokMan(valueMan) {
    if (!valueMan || isNaN(valueMan)) return { eok: '0억 원', man: '0 만원' };
    const eokPart = (valueMan / 10000).toFixed(1);
    const formattedMan = Math.round(valueMan).toLocaleString('ko-KR');
    return { eok: `${eokPart}억 원`, man: `(${formattedMan} 만원)` };
}

function formatEokShort(valueMan) {
    if (!valueMan || isNaN(valueMan)) return '0억';
    const eok = valueMan / 10000;
    if (eok >= 1) return `${eok.toFixed(1)}억`;
    return `${Math.round(valueMan).toLocaleString()}만`;
}

// Load API or Fallback Data
document.addEventListener('DOMContentLoaded', async () => {
    let loaded = false;

    // 1. Try Cloudflare Pages Serverless Function Endpoint (/api/rent)
    try {
        const response = await fetch('/api/rent');
        if (response.ok) {
            const resData = await response.json();
            if (resData && resData.data && resData.data.length > 0) {
                rawData = resData.data;
                loaded = true;
                if (statusBadge) {
                    statusBadge.innerHTML = '<span class="dot"></span> Cloudflare API 연동 완료';
                }
            }
        }
    } catch (e) {
        console.warn('Cloudflare function /api/rent not active in static mode, using fallback dataset.', e);
    }

    // 2. Static Fallback Dataset (data/jeonse_mean.json)
    if (!loaded) {
        try {
            const fallbackResponse = await fetch('data/jeonse_mean.json');
            if (fallbackResponse.ok) {
                rawData = await fallbackResponse.json();
                loaded = true;
                if (statusBadge) {
                    statusBadge.innerHTML = '<span class="dot" style="background:#3B82F6"></span> 로컬 API 데이터셋 로드 완료';
                }
            }
        } catch (err) {
            console.error('Failed to load fallback dataset:', err);
        }
    }

    if (loaded && rawData.length > 0) {
        processData();
        initDropdowns();
        renderDistrictOverview();
    }
});

// Index data by district -> dong -> items
function processData() {
    groupedData = {};
    rawData.forEach(row => {
        const cgg = row.CGG_NM;
        const stdg = row.STDG_NM;
        
        if (!cgg || !stdg) return;
        
        if (!groupedData[cgg]) {
            groupedData[cgg] = {};
        }
        if (!groupedData[cgg][stdg]) {
            groupedData[cgg][stdg] = [];
        }
        groupedData[cgg][stdg].push(row);
    });
}

// Initialize District Dropdown
function initDropdowns() {
    const districts = Object.keys(groupedData).sort();
    
    districtSelect.innerHTML = '<option value="">-- 자치구 선택 --</option>';
    districts.forEach(dist => {
        const opt = document.createElement('option');
        opt.value = dist;
        opt.textContent = dist;
        districtSelect.appendChild(opt);
    });

    districtSelect.addEventListener('change', handleDistrictChange);
    dongSelect.addEventListener('change', handleDongChange);
    buildingSelect.addEventListener('change', handleBuildingChange);
}

// District selection change
function handleDistrictChange() {
    const selectedDistrict = districtSelect.value;
    
    dongSelect.innerHTML = '<option value="">-- 행정동/법정동 선택 --</option>';
    buildingSelect.innerHTML = '<option value="">-- 동을 먼저 선택해 주세요 --</option>';
    buildingSelect.disabled = true;

    if (!selectedDistrict || !groupedData[selectedDistrict]) {
        dongSelect.disabled = true;
        hideResult();
        return;
    }

    const dongs = Object.keys(groupedData[selectedDistrict]).sort();
    dongs.forEach(dong => {
        const opt = document.createElement('option');
        opt.value = dong;
        opt.textContent = dong;
        dongSelect.appendChild(opt);
    });

    dongSelect.disabled = false;
    hideResult();
}

// Dong selection change
function handleDongChange() {
    const selectedDistrict = districtSelect.value;
    const selectedDong = dongSelect.value;

    buildingSelect.innerHTML = '<option value="">-- 주택유형 선택 --</option>';

    if (!selectedDong || !groupedData[selectedDistrict] || !groupedData[selectedDistrict][selectedDong]) {
        buildingSelect.disabled = true;
        hideResult();
        return;
    }

    const items = groupedData[selectedDistrict][selectedDong];
    const types = items.map(item => item.BLDG_USG).filter(Boolean).sort();

    types.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        buildingSelect.appendChild(opt);
    });

    buildingSelect.disabled = false;
    
    if (types.length > 0) {
        buildingSelect.value = types[0];
        handleBuildingChange();
    }
}

// Building Type selection change
function handleBuildingChange() {
    const selectedDistrict = districtSelect.value;
    const selectedDong = dongSelect.value;
    const selectedBldg = buildingSelect.value;

    if (!selectedDistrict || !selectedDong || !selectedBldg) {
        hideResult();
        return;
    }

    const items = groupedData[selectedDistrict][selectedDong];
    const targetItem = items.find(item => item.BLDG_USG === selectedBldg);

    if (targetItem) {
        renderResult(selectedDistrict, selectedDong, selectedBldg, targetItem, items);
    }
}

// Render Results
function renderResult(district, dong, bldg, item, allDongItems) {
    placeholderSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    resCgg.textContent = district;
    resStdg.textContent = dong;
    resBldg.textContent = bldg;

    const formatted = formatEokMan(item.AVG_GRFE);
    resAvgEok.textContent = formatted.eok;
    resAvgMan.textContent = formatted.man;
    resCount.textContent = item.COUNT.toLocaleString();

    const medianFormatted = formatEokMan(item.MEDIAN_GRFE);
    resMedian.textContent = medianFormatted.eok;

    resMin.textContent = formatEokShort(item.MIN_GRFE);
    resMax.textContent = formatEokShort(item.MAX_GRFE);

    resArea.textContent = `${item.AVG_AREA} ㎡`;
    resPyung.textContent = (item.AVG_AREA / 3.30578).toFixed(1);

    chartLocationName.textContent = `${district} ${dong}`;

    renderTypeList(allDongItems, bldg);
    renderChart(allDongItems, bldg);
}

function hideResult() {
    resultSection.classList.add('hidden');
    placeholderSection.classList.remove('hidden');
}

// Render Type List
function renderTypeList(items, activeBldg) {
    typeListContainer.innerHTML = '';
    
    items.sort((a, b) => b.AVG_GRFE - a.AVG_GRFE).forEach(item => {
        const div = document.createElement('div');
        div.className = `type-item ${item.BLDG_USG === activeBldg ? 'active' : ''}`;
        
        const priceFmt = formatEokMan(item.AVG_GRFE).eok;
        
        div.innerHTML = `
            <div>
                <span class="type-name">${item.BLDG_USG}</span>
                <span class="type-count">(${item.COUNT}건)</span>
            </div>
            <div class="type-price">${priceFmt}</div>
        `;
        typeListContainer.appendChild(div);
    });
}

// Render Chart
function renderChart(items, activeBldg) {
    const ctx = document.getElementById('typeComparisonChart').getContext('2d');
    
    const labels = items.map(i => i.BLDG_USG);
    const data = items.map(i => (i.AVG_GRFE / 10000).toFixed(2));
    const backgroundColors = items.map(i => i.BLDG_USG === activeBldg ? '#FF6B00' : '#E2E8F0');
    const borderColors = items.map(i => i.BLDG_USG === activeBldg ? '#FF6B00' : '#CBD5E1');

    if (comparisonChart) {
        comparisonChart.destroy();
    }

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '평균 전세가 (억 원)',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1.5,
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` 평균 전세가: ${context.parsed.y}억 원`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: '억 원', color: '#64748B' },
                    grid: { color: '#F1F5F9' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// Render District Overview Cards
function renderDistrictOverview() {
    districtOverviewGrid.innerHTML = '';
    
    const districtApts = {};
    rawData.filter(row => row.BLDG_USG === '아파트').forEach(row => {
        const cgg = row.CGG_NM;
        if (!districtApts[cgg]) {
            districtApts[cgg] = { totalGrfe: 0, count: 0 };
        }
        districtApts[cgg].totalGrfe += row.AVG_GRFE * row.COUNT;
        districtApts[cgg].count += row.COUNT;
    });

    const list = Object.keys(districtApts).map(cgg => {
        const avg = districtApts[cgg].totalGrfe / districtApts[cgg].count;
        return { cgg, avg };
    }).sort((a, b) => b.avg - a.avg);

    list.slice(0, 8).forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'overview-card';
        
        const priceStr = (item.avg / 10000).toFixed(1) + '억 원';
        
        card.innerHTML = `
            <span class="overview-rank">Top ${index + 1}</span>
            <div class="overview-cgg">${item.cgg}</div>
            <div class="overview-price">${priceStr}</div>
        `;
        
        card.addEventListener('click', () => {
            districtSelect.value = item.cgg;
            handleDistrictChange();
            window.scrollTo({ top: 200, behavior: 'smooth' });
        });
        
        districtOverviewGrid.appendChild(card);
    });
}
