import { useState, useEffect, useRef, useCallback, type FC } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import type { QuestionData } from "./types";
import {
  playTimerTick,
  playTimeExpired,
  playSubmit,
  playQuestionStart,
} from "../../lib/sounds";

// World map topology - using Natural Earth data with ISO-3166 alpha-3 codes
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Mapping from ISO alpha-3 to numeric codes used in world-atlas
const ALPHA3_TO_NUMERIC: Record<string, string> = {
  AFG: "004", ALB: "008", DZA: "012", AGO: "024", ARG: "032",
  ARM: "051", AUS: "036", AUT: "040", AZE: "031", BGD: "050",
  BLR: "112", BEL: "056", BLZ: "084", BEN: "204", BTN: "064",
  BOL: "068", BIH: "070", BWA: "072", BRA: "076", BRN: "096",
  BGR: "100", BFA: "854", BDI: "108", KHM: "116", CMR: "120",
  CAN: "124", CAF: "140", TCD: "148", CHL: "152", CHN: "156",
  COL: "170", COD: "180", COG: "178", CRI: "188", CIV: "384",
  HRV: "191", CUB: "192", CYP: "196", CZE: "203", DNK: "208",
  DJI: "262", DOM: "214", ECU: "218", EGY: "818", SLV: "222",
  GNQ: "226", ERI: "232", EST: "233", ETH: "231", FJI: "242",
  FIN: "246", FRA: "250", GAB: "266", GMB: "270", GEO: "268",
  DEU: "276", GHA: "288", GRC: "300", GTM: "320", GIN: "324",
  GNB: "624", GUY: "328", HTI: "332", HND: "340", HUN: "348",
  ISL: "352", IND: "356", IDN: "360", IRN: "364", IRQ: "368",
  IRL: "372", ISR: "376", ITA: "380", JAM: "388", JPN: "392",
  JOR: "400", KAZ: "398", KEN: "404", PRK: "408", KOR: "410",
  KWT: "414", KGZ: "417", LAO: "418", LVA: "428", LBN: "422",
  LSO: "426", LBR: "430", LBY: "434", LTU: "440", LUX: "442",
  MKD: "807", MDG: "450", MWI: "454", MYS: "458", MLI: "466",
  MLT: "470", MRT: "478", MEX: "484", MDA: "498", MNG: "496",
  MNE: "499", MAR: "504", MOZ: "508", MMR: "104", NAM: "516",
  NPL: "524", NLD: "528", NZL: "554", NIC: "558", NER: "562",
  NGA: "566", NOR: "578", OMN: "512", PAK: "586", PSE: "275",
  PAN: "591", PNG: "598", PRY: "600", PER: "604", PHL: "608",
  POL: "616", PRT: "620", QAT: "634", ROU: "642", RUS: "643",
  RWA: "646", SAU: "682", SEN: "686", SRB: "688", SLE: "694",
  SGP: "702", SVK: "703", SVN: "705", SOM: "706", ZAF: "710",
  SSD: "728", ESP: "724", LKA: "144", SDN: "729", SUR: "740",
  SWZ: "748", SWE: "752", CHE: "756", SYR: "760", TWN: "158",
  TJK: "762", TZA: "834", THA: "764", TLS: "626", TGO: "768",
  TTO: "780", TUN: "788", TUR: "792", TKM: "795", UGA: "800",
  UKR: "804", ARE: "784", GBR: "826", USA: "840", URY: "858",
  UZB: "860", VEN: "862", VNM: "704", YEM: "887", ZMB: "894",
  ZWE: "716",
};

interface MapQuestionCardProps {
  data: QuestionData;
}

const MapQuestionCard: FC<MapQuestionCardProps> = ({ data }) => {
  const {
    questionIndex,
    totalQuestions,
    question,
    category,
    difficulty,
    timerSeconds,
    delegate,
    mapData,
    options,
  } = data;

  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const displayTimeRef = useRef(Date.now());
  const hasAckedRef = useRef(false);

  // Map zoom state - start with a global view, then zoom to the country
  const [position, setPosition] = useState({
    coordinates: [0, 20] as [number, number],
    zoom: 1,
  });
  const [hasZoomed, setHasZoomed] = useState(false);

  // Acknowledge delegate on mount and play question start sound
  useEffect(() => {
    if (!hasAckedRef.current && delegate.ack_url) {
      hasAckedRef.current = true;
      fetch(delegate.ack_url, { method: "POST" }).catch(console.error);
      displayTimeRef.current = Date.now();
      playQuestionStart();
    }
  }, [delegate.ack_url]);

  // Zoom to the highlighted country after a short delay
  useEffect(() => {
    if (mapData && !hasZoomed) {
      const timer = setTimeout(() => {
        setPosition({
          coordinates: mapData.center,
          zoom: mapData.zoom,
        });
        setHasZoomed(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mapData, hasZoomed]);

  // Timer countdown
  useEffect(() => {
    if (isExpired) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          setIsExpired(true);
          playTimeExpired();
          return 0;
        }
        if (newTime <= 5) {
          playTimerTick();
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isExpired]);

  const submitAnswer = async (answer: string) => {
    if (isSubmitted || isExpired) return;

    const timeToAnswerMs = Date.now() - displayTimeRef.current;
    setSelectedAnswer(answer);
    setIsSubmitted(true);
    playSubmit();

    try {
      await fetch(delegate.fulfill_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, timeToAnswerMs }),
      });
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  };

  // Handle map position changes (for touch zoom/pan)
  const handleMoveEnd = useCallback((position: { coordinates: [number, number]; zoom: number }) => {
    setPosition(position);
  }, []);

  const progress = (timeLeft / timerSeconds) * 100;
  const isLowTime = timeLeft <= 5;

  // Determine if a geography should be highlighted
  // The world-atlas topojson uses numeric ISO codes as IDs
  const isHighlighted = (geo: { properties: Record<string, unknown>; id?: string }) => {
    if (!mapData) return false;
    const alpha3 = mapData.countryAlpha3;
    const numericCode = ALPHA3_TO_NUMERIC[alpha3];

    // Check the geo ID against the numeric code (world-atlas format)
    // Also check various property names for compatibility with other topojson sources
    return (
      geo.id === numericCode ||
      geo.id === alpha3 ||
      geo.properties.ISO_A3 === alpha3 ||
      geo.properties.iso_a3 === alpha3 ||
      geo.properties.ISO_A3_EH === alpha3 ||
      geo.properties.ADM0_A3 === alpha3
    );
  };

  return (
    <div className={`trivia-question map-question ${isExpired ? "expired" : ""}`}>
      {/* Header */}
      <div className="question-header">
        <span className="question-number">
          Question {questionIndex + 1} of {totalQuestions}
        </span>
        {category && <span className="question-category">{category}</span>}
        {difficulty && (
          <span className={`question-difficulty ${difficulty}`}>
            {difficulty}
          </span>
        )}
      </div>

      {/* Timer */}
      <div className="question-timer">
        <div
          className={`timer-bar ${isLowTime ? "low-time" : ""}`}
          style={{ width: `${progress}%` }}
        />
        <span className={`timer-text ${isLowTime ? "low-time" : ""}`}>
          {timeLeft}s
        </span>
      </div>

      {/* Question text */}
      <div className="question-text">{question}</div>

      {/* Map Container */}
      <div className="map-container">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 100,
          }}
          style={{
            width: "100%",
            height: "auto",
          }}
        >
          <ZoomableGroup
            center={position.coordinates}
            zoom={position.zoom}
            onMoveEnd={handleMoveEnd}
            minZoom={1}
            maxZoom={12}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const highlighted = isHighlighted(geo);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: highlighted ? "#3b82f6" : "#e5e7eb",
                          stroke: highlighted ? "#1d4ed8" : "#9ca3af",
                          strokeWidth: highlighted ? 1.5 : 0.5,
                          outline: "none",
                        },
                        hover: {
                          fill: highlighted ? "#3b82f6" : "#d1d5db",
                          stroke: highlighted ? "#1d4ed8" : "#9ca3af",
                          strokeWidth: highlighted ? 1.5 : 0.5,
                          outline: "none",
                        },
                        pressed: {
                          fill: highlighted ? "#3b82f6" : "#d1d5db",
                          stroke: highlighted ? "#1d4ed8" : "#9ca3af",
                          strokeWidth: highlighted ? 1.5 : 0.5,
                          outline: "none",
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
        <div className="map-hint">Pinch to zoom, drag to pan</div>
      </div>

      {/* Answer controls - Multiple choice from options */}
      <div className="question-answers">
        {isSubmitted ? (
          <div className="answer-submitted">
            <span className="submitted-icon">✓</span>
            <span>Answer submitted! Waiting for results...</span>
          </div>
        ) : isExpired ? (
          <div className="answer-expired">
            <span className="expired-icon">⏱</span>
            <span>Time's up!</span>
          </div>
        ) : options ? (
          <div className="answer-buttons mc-buttons">
            {options.map((option, index) => (
              <button
                key={index}
                className={`answer-btn mc-btn ${selectedAnswer === option ? "selected" : ""}`}
                onClick={() => submitAnswer(option)}
              >
                <span className="option-letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="option-text">{option}</span>
              </button>
            ))}
          </div>
        ) : (
          // Fallback to text input if no options provided
          <div className="map-text-input">
            <input
              type="text"
              placeholder="Type the country name..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    submitAnswer(input.value.trim());
                  }
                }
              }}
              autoFocus
            />
            <button
              className="submit-btn"
              onClick={(e) => {
                const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                if (input.value.trim()) {
                  submitAnswer(input.value.trim());
                }
              }}
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapQuestionCard;
