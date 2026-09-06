import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Seeds curated football news stories across various competition categories
export async function GET() {
  try {
    const footballNews = [
      {
        headline: "UEFA Champions League Knockout Stage Draw: Matchups Confirmed",
        category: "Champions League",
        content: "The UEFA Champions League knockout stages kick off as Europe's elite clubs battle for continental glory in high-stakes two-legged ties.",
        teamId: 541
      },
      {
        headline: "Premier League Title Race Heating Up Heading Into Final Months",
        category: "Premier League",
        content: "Arsenal, Manchester City, and Liverpool remain locked in a thriller title race with key head-to-head fixtures approaching.",
        teamId: 50
      },
      {
        headline: "El Clasico Preview: Real Madrid vs Barcelona Tactical Breakdown",
        category: "La Liga",
        content: "Tactical preview analyzing key player matchups, midfield pressing schemes, and counter-attacking threats ahead of El Clasico.",
        teamId: 529
      },
      {
        headline: "Serie A Derby della Madonnina: Inter & Milan Battle For Supremacy",
        category: "Serie A",
        content: "San Siro hosts a dramatic derby clash as both Milan giants compete for vital league points and local bragging rights.",
        teamId: 108
      },
      {
        headline: "Saudi Pro League Global Viewership Surges Across 140 Countries",
        category: "Global Football",
        content: "International TV rights expansion drives unprecedented interest in the Saudi Pro League following star-studded squad transfers.",
        teamId: 307
      },
      {
        headline: "Bundesliga Top Goalscorer Race: Kane Leads Golden Boot Tally",
        category: "Bundesliga",
        content: "Harry Kane maintains his prolific scoring pace at Bayern Munich as the Bundesliga enters crucial spring fixtures.",
        teamId: 157
      },
      {
        headline: "Ballon d'Or Power Rankings: Leading Candidates Analyzed",
        category: "Awards",
        content: "Evaluating season statistics, trophy achievements, and match-winning performances for this year's top Ballon d'Or contenders.",
        teamId: 33
      },
      {
        headline: "FIFA World Cup Expansion: Tournament Format Details Released",
        category: "World Cup",
        content: "FIFA outlines group stage scheduling, host venue logistics, and team qualification paths for the upcoming enlarged World Cup.",
        teamId: 1
      }
    ];

    let newsAdded = 0;
    for (const item of footballNews) {
      const res = await pool.query(`
        INSERT INTO News (Team_ID, Category, Headline, Content)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING;
      `, [item.teamId, item.category, item.headline, item.content]);
      if (res.rowCount > 0) newsAdded++;
    }

    const { rows: countRes } = await pool.query(`SELECT COUNT(*) FROM News;`);

    return NextResponse.json({
      success: true,
      message: 'Football News Sync Complete!',
      stats: {
        totalNewsArticles: parseInt(countRes[0].count, 10)
      }
    });

  } catch (err) {
    console.error("News sync failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
