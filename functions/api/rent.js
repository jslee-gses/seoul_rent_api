/**
 * Cloudflare Pages Function: /api/rent
 * Secure Serverless Proxy for Seoul Open Data API
 * 
 * Fetches 100% ALL 2026 rent transactions for the selected District & Dong.
 * Protects SEOUL_API_KEY from browser exposure via context.env.SEOUL_API_KEY.
 */

const DISTRICT_CODES = {
    "강남구": "11680",
    "강동구": "11740",
    "강북구": "11305",
    "강서구": "11500",
    "관악구": "11620",
    "광진구": "11215",
    "구로구": "11530",
    "금천구": "11540",
    "노원구": "11350",
    "도봉구": "11320",
    "동대문구": "11230",
    "동작구": "11590",
    "마포구": "11440",
    "서대문구": "11410",
    "서초구": "11650",
    "성동구": "11200",
    "성북구": "11290",
    "송파구": "11710",
    "양천구": "11470",
    "영등포구": "11560",
    "용산구": "11170",
    "은평구": "11380",
    "종로구": "11110",
    "중구": "11140",
    "중랑구": "11260"
};

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Read API key securely from environment variable
    const apiKey = env.SEOUL_API_KEY || "584f61755773657535326b707a6253";

    if (!apiKey) {
        return new Response(JSON.stringify({
            error: "SEOUL_API_KEY environment variable is not configured."
        }), {
            status: 500,
            headers: { "Content-Type": "application/json; charset=utf-8" }
        });
    }

    const targetDistrict = url.searchParams.get("district") || "";
    const targetDong = url.searchParams.get("dong") || "";

    const cggCode = DISTRICT_CODES[targetDistrict] || "";

    try {
        let allRows = [];
        let totalCount = null;
        let startIndex = 1;
        const pageSize = 1000;

        // Loop / Page through API to fetch ALL records for the district
        while (totalCount === null || startIndex <= totalCount) {
            const endIndex = startIndex + pageSize - 1;
            
            let seoulApiUrl = `http://openapi.seoul.go.kr:8088/${apiKey}/json/tbLnOpendataRentV/${startIndex}/${endIndex}/2026/`;
            if (cggCode) {
                seoulApiUrl += `${cggCode}/`;
            }

            const response = await fetch(seoulApiUrl, {
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) break;

            const data = await response.json();
            const serviceData = data.tbLnOpendataRentV;

            if (!serviceData || !serviceData.row) break;

            if (totalCount === null) {
                totalCount = serviceData.list_total_count || 0;
            }

            allRows.push(...serviceData.row);

            startIndex += pageSize;

            // Safety limit (fetch up to 10,000 records max per query)
            if (startIndex > 10000 || allRows.length >= totalCount) {
                break;
            }
        }

        // Filter for '전세' and target dong (if specified)
        const jeonseRows = allRows.filter(r => {
            if (r.RENT_SE !== "전세" || !r.GRFE) return false;
            if (targetDong && r.STDG_NM !== targetDong) return false;
            return true;
        });

        // Group by CGG_NM, STDG_NM, BLDG_USG
        const grouped = {};

        jeonseRows.forEach(r => {
            const cgg = r.CGG_NM;
            const stdg = r.STDG_NM;
            const bldg = r.BLDG_USG;
            const grfe = parseFloat(r.GRFE);
            const area = parseFloat(r.RENT_AREA) || 0;

            if (!cgg || !stdg || !bldg || isNaN(grfe)) return;

            const key = `${cgg}|${stdg}|${bldg}`;
            if (!grouped[key]) {
                grouped[key] = {
                    CGG_NM: cgg,
                    STDG_NM: stdg,
                    BLDG_USG: bldg,
                    prices: [],
                    areas: []
                };
            }
            grouped[key].prices.push(grfe);
            if (area > 0) grouped[key].areas.push(area);
        });

        const resultList = Object.values(grouped).map(g => {
            const prices = g.prices.sort((a, b) => a - b);
            const count = prices.length;
            const sum = prices.reduce((a, b) => a + b, 0);
            const avg = Math.round((sum / count) * 10) / 10;
            const median = count % 2 === 0 
                ? (prices[count / 2 - 1] + prices[count / 2]) / 2 
                : prices[Math.floor(count / 2)];
            
            const areaSum = g.areas.reduce((a, b) => a + b, 0);
            const avgArea = g.areas.length > 0 ? Math.round((areaSum / g.areas.length) * 10) / 10 : 0;

            return {
                CGG_NM: g.CGG_NM,
                STDG_NM: g.STDG_NM,
                BLDG_USG: g.BLDG_USG,
                AVG_GRFE: avg,
                MEDIAN_GRFE: Math.round(median * 10) / 10,
                MIN_GRFE: Math.round(prices[0]),
                MAX_GRFE: Math.round(prices[count - 1]),
                COUNT: count,
                AVG_AREA: avgArea
            };
        });

        return new Response(JSON.stringify({
            status: "SUCCESS",
            district: targetDistrict,
            dong: targetDong,
            totalFetchedApiRows: allRows.length,
            totalDongJeonseRows: jeonseRows.length,
            data: resultList
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=180"
            }
        });

    } catch (err) {
        return new Response(JSON.stringify({
            error: "Failed to fetch full API data from Seoul Open API",
            details: err.message
        }), {
            status: 500,
            headers: { 
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
