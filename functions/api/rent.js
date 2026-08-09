/**
 * Cloudflare Pages Function: /api/rent
 * Secure Serverless Proxy for Seoul Open Data API
 * 
 * Protects SEOUL_API_KEY from browser exposure.
 * Refer to context.env.SEOUL_API_KEY set in Cloudflare Dashboard Environment Variables.
 */

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Read secret API Key from environment variable
    const apiKey = env.SEOUL_API_KEY || "584f61755773657535326b707a6253";

    if (!apiKey) {
        return new Response(JSON.stringify({
            error: "SEOUL_API_KEY environment variable is not configured."
        }), {
            status: 500,
            headers: { "Content-Type": "application/json; charset=utf-8" }
        });
    }

    // Optional URL query parameters: ?district=강남구&dong=역삼동&bldg=아파트
    const targetDistrict = url.searchParams.get("district") || "";
    const targetDong = url.searchParams.get("dong") || "";
    const targetBldg = url.searchParams.get("bldg") || "";

    try {
        // Fetch 2026 Seoul Rent Data from Open API (Server to Server)
        const seoulApiUrl = `http://openapi.seoul.go.kr:8088/${apiKey}/json/tbLnOpendataRentV/1/1000/2026/`;
        
        const response = await fetch(seoulApiUrl, {
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Seoul API responded with status ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.tbLnOpendataRentV || !data.tbLnOpendataRentV.row) {
            return new Response(JSON.stringify({
                status: "EMPTY",
                message: "No rent data found for 2026",
                rows: []
            }), {
                headers: { 
                    "Content-Type": "application/json; charset=utf-8",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        const rows = data.tbLnOpendataRentV.row;

        // Filter for '전세' (Jeonse)
        const jeonseRows = rows.filter(r => r.RENT_SE === "전세" && r.GRFE);

        // Aggregate by CGG_NM, STDG_NM, BLDG_USG
        const grouped = {};

        jeonseRows.forEach(r => {
            const cgg = r.CGG_NM;
            const stdg = r.STDG_NM;
            const bldg = r.BLDG_USG;
            const grfe = parseFloat(r.GRFE);
            const area = parseFloat(r.RENT_AREA) || 0;

            if (!cgg || !stdg || !bldg || isNaN(grfe)) return;

            // Optional client side query filtering
            if (targetDistrict && cgg !== targetDistrict) return;
            if (targetDong && stdg !== targetDong) return;
            if (targetBldg && bldg !== targetBldg) return;

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
            totalRecords: data.tbLnOpendataRentV.list_total_count,
            count: resultList.length,
            data: resultList
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=300"
            }
        });

    } catch (err) {
        return new Response(JSON.stringify({
            error: "Failed to fetch from Seoul Open API",
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
