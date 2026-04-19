import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Search,
  History, 
  Leaf, 
  Info, 
  Trash2, 
  ChevronRight, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  MapPin,
  Navigation,
  Quote,
  Loader2,
  Clock,
  ExternalLink,
  MessageSquare,
  Globe
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin 
} from '@vis.gl/react-google-maps';
import { cn } from './lib/utils';
import { Product, ScanHistory } from './types';
import { BOTTLE_DATABASE } from './data/items';
import { GoogleGenAI } from '@google/genai';

// --- Types & Constants ---
type Tab = 'dashboard' | 'scan' | 'impact' | 'places';

const AI_MODEL = 'gemini-3-flash-preview';
const MAP_ID = 'da37f3254c096d87'; // Placeholder for advanced markers

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });
  const [mapZoom, setMapZoom] = useState(12);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);

  const DEPOSIT_LOCATIONS = [
    { 
      id: 'wf-fidi', 
      name: "WF: 66 Broadway", 
      address: "Financial District", 
      status: "Open", 
      type: 'retail', 
      lat: 40.7073, 
      lng: -74.0121,
      hours: "7:00 AM - 10:00 PM",
      website: "https://www.wholefoodsmarket.com/stores/onewallstreet",
      tips: "Self-service internal machines are located near the Broadway entrance."
    },
    { 
      id: 'wf-union', 
      name: "WF: 4 Union Sq E", 
      address: "Union Square", 
      status: "Open", 
      type: 'retail', 
      lat: 40.7347, 
      lng: -73.9904,
      hours: "7:00 AM - 10:00 PM",
      website: "https://www.wholefoodsmarket.com/stores/unionsquare",
      tips: "One of the busiest locations. Try to go during off-peak hours (before 10 AM)."
    },
    { 
      id: 'wf-bryant', 
      name: "WF: 1095 6th Ave", 
      address: "Midtown / Bryant Park", 
      status: "Open", 
      type: 'retail', 
      lat: 40.7552, 
      lng: -73.9845,
      hours: "7:00 AM - 10:00 PM",
      website: "https://www.wholefoodsmarket.com/stores/bryantpark",
      tips: "Midtown office workers use this frequently. Machines are well-maintained."
    },
    { 
      id: 'wf-ues-87', 
      name: "WF: 1551 3rd Ave", 
      address: "UES / 87th St", 
      status: "Open", 
      type: 'retail', 
      lat: 40.7797, 
      lng: -73.9549,
      hours: "7:00 AM - 10:00 PM",
      website: "https://www.wholefoodsmarket.com/stores/upper-east-side",
      tips: "Great stock, but machines can fill up quickly on weekends."
    },
    { 
      id: 'wf-ues-69', 
      name: "WF: 1175 3rd Ave", 
      address: "Lenox Hill / 69th St", 
      status: "Open", 
      type: 'retail', 
      lat: 40.7674, 
      lng: -73.9624,
      hours: "7:00 AM - 10:00 PM",
      website: "https://www.wholefoodsmarket.com/stores/69thstreet",
      tips: "Compact store, easy to navigate if you have just a few returns."
    }
  ];

  const focusLocation = (lat: number, lng: number, location?: any) => {
    setMapCenter({ lat, lng });
    setMapZoom(16);
    if (location) setSelectedLocation(location);
  };

  const handleStoreSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !process.env.GEMINI_API_KEY) return;

    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Find 5 ${searchQuery} locations in New York City that would likely accept bottle deposits (supermarkets, big box stores).
      Return ONLY a JSON array of objects:
      [
        {
          "id": "string",
          "name": "string",
          "address": "string",
          "status": "Open",
          "type": "retail",
          "lat": number,
          "lng": number,
          "hours": "7 AM - 10 PM",
          "website": "URL",
          "tips": "Brief tip about returns"
        }
      ]
      Focus on specialized Manhattan/Brooklyn locations if the query is general. 
      Ensure lat/lng are accurate NYC coordinates.`;

      const result = await (ai as any).models.generateContent({
        model: AI_MODEL,
        contents: prompt
      });
      const text = result.text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const locations = JSON.parse(jsonMatch[0]);
        setSearchResults(locations);
        if (locations.length > 0) {
          focusLocation(locations[0].lat, locations[0].lng);
        }
      }
    } catch (error) {
      console.error("Store search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };
  useEffect(() => {
    const saved = localStorage.getItem('rescan_history');
    if (saved) {
      try {
        const parsed: ScanHistory[] = JSON.parse(saved);
        // Robust deduplication on load to prevent crashes from legacy or corrupted data
        const unique = parsed.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        setHistory(unique);
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('rescan_history', JSON.stringify(history));
  }, [history]);

  // --- Scanning Logic ---
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanner = () => {
    setScanError(null);
    setActiveTab('scan');
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (activeTab === 'scan' && !showResult && !showDetails) {
      const timer = setTimeout(async () => {
        try {
          const element = document.getElementById('qr-reader');
          if (element) {
            html5QrCode = new Html5Qrcode("qr-reader", { 
              verbose: false,
              formatsToSupport: [
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
              ]
            });
            scannerRef.current = html5QrCode;

            const config = { 
              fps: 20, 
              qrbox: { width: 250, height: 150 }, // Shorter height for barcode optimization
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
              }
            };
            
            await html5QrCode.start(
              { facingMode: "environment" }, 
              config,
              (decodedText) => {
                handleScanSuccess(decodedText);
              },
              undefined // error callback omitted for performance
            );
          }
        } catch (err: any) {
          console.error("Camera start error:", err);
          if (err?.name === "NotAllowedError" || err?.message?.includes("Permission")) {
            setScanError("Camera access denied. Please enable permissions in browser settings.");
          } else {
            setScanError("Could not access camera. Ensure no other app is using it.");
          }
        }
      }, 500);

      return () => {
        clearTimeout(timer);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(err => console.error("Failed to stop scanner", err));
        }
      };
    }
  }, [activeTab, showResult, showDetails]);

  const isProcessingRef = useRef(false);

  const handleScanSuccess = async (barcode: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // Stop scanning immediately on success
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error("Error stopping scanner after success", e);
      }
    }
    
    let product: Product | null = null;

    try {
      // 1. Direct Local Sync Lookup (Instant)
      if (BOTTLE_DATABASE[barcode]) {
        product = BOTTLE_DATABASE[barcode];
      } else {
        // 2. High-speed Fallback: Open Food Facts
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const offResponse = await fetch(
            `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
            { signal: controller.signal }
          ).finally(() => clearTimeout(timeoutId));
          
          if (offResponse.ok) {
            const offData = await offResponse.json();
            if (offData.status === 1 && offData.product) {
              const offProduct = offData.product;
              const isBeverage = offProduct.categories_tags?.some((c: string) => 
                c.includes('beverages') || c.includes('drinks')
              );
              
              const name = offProduct.product_name || "";
              const pName = name.toLowerCase();
              const packaging = (offProduct.packaging || "").toLowerCase();
              const isCan = pName.includes("can") || 
                            packaging.includes("can") || 
                            packaging.includes("aluminum") ||
                            pName.includes("celsius") || 
                            pName.includes("red bull") ||
                            pName.includes("energy drink");

              product = {
                barcode,
                name: name || `Item #${barcode.slice(-4)}`,
                brand: offProduct.brands || "Unknown Brand",
                type: isBeverage ? (isCan ? 'Aluminum' : 'Plastic') : 'Other', 
                accepted: !!isBeverage,
                value: isBeverage ? 0.05 : 0,
                instructions: isBeverage ? `NYC Deposit Eligible. ${isCan ? 'Aluminum Can' : 'Check for 5¢ mark'}.` : "Check packaging for recycling symbols."
              };
            }
          }
        } catch (apiError) {
          console.warn("External API lookup failed or timed out:", apiError);
        }

        // 3. Last Fallback: AI Deep Research (Only if still null)
        if (!product && process.env.GEMINI_API_KEY) {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const model = ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Identify barcode ${barcode}. 
            Return ONLY JSON: { "barcode": "${barcode}", "name": "string", "brand": "string", "type": "Plastic"|"Glass"|"Aluminum"|"Paper"|"Other", "accepted": boolean, "value": number, "instructions": "string" }
            
            NYC CONTEXT: 
            - If the product is a beverage bottle or can (soda, water, beer, carbonated drinks), set "accepted" to true and "value" to 0.05.
            - If the product is eligible for the NYC Bottle Deposit program, explicitly mention "NYC Deposit Eligible" in instructions.
            - If it's a generic recycling item (paper, certain plastics) without deposit, set "value" to 0 but "accepted" to true if curbside recyclable.`
          });
          const result = await model;
          const text = result.text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            product = JSON.parse(jsonMatch[0]);
          }
        }
      }
    } catch (error) {
      console.error("Lookup main logic failed:", error);
    }

    // Final fallback for purely offline/error states
    if (!product) {
      product = {
        barcode,
        name: `Item #${barcode.slice(-4)}`,
        brand: "Unknown Brand",
        type: "Other",
        accepted: false,
        value: 0,
        instructions: "Manual verification needed. Not found in our database."
      };
    }

    setScannedProduct(product);
    setHistory(prev => [{
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      product: product!,
      timestamp: Date.now()
    }, ...prev]);
    
    setShowResult(true);
    setShowDetails(false);
    isProcessingRef.current = false;
  };

  const closeScanner = () => {
    setActiveTab('dashboard');
  };

  // --- Calculations ---
  const totalImpact = history.reduce((acc, item) => acc + item.product.value, 0);
  const itemsRecycled = history.filter(h => h.product.accepted).length;

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-brand-bg font-sans shadow-xl relative overflow-hidden text-brand-text">
      {/* Header */}
      <header className="px-6 py-4 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2 tracking-tight font-serif italic">
            <Leaf className="w-6 h-6 fill-brand-primary" />
            Bottle It
          </h1>
          <p className="text-[10px] text-brand-secondary font-black tracking-widest uppercase">Eco Companion</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-brand-bg flex items-center justify-center text-brand-primary">
          <Info className="w-5 h-5" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Bar */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-brand-primary rounded-3xl p-5 text-white shadow-lg shadow-brand-primary/10 relative overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Impact</p>
                    <p className="text-3xl font-black mt-1 tracking-tighter font-serif italic">${totalImpact.toFixed(2)}</p>
                  </div>
                  <Leaf className="absolute -bottom-4 -right-4 w-20 h-20 opacity-10 rotate-12" />
                </div>
                <div className="bg-white rounded-3xl p-5 border border-brand-accent/20 shadow-sm text-brand-text">
                  <p className="text-[10px] font-black text-brand-secondary uppercase tracking-widest">Recycled</p>
                  <p className="text-3xl font-black mt-1 tracking-tighter font-serif">{itemsRecycled}</p>
                </div>
              </div>

              {/* Main Action */}
              <button 
                onClick={startScanner}
                className="w-full bg-white border border-brand-accent/30 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 group transition-all hover:bg-brand-bg active:scale-[0.98]"
              >
                <div className="w-20 h-20 rounded-full bg-brand-primary flex items-center justify-center text-white shadow-xl shadow-brand-primary/20 group-hover:scale-110 transition-transform duration-500">
                  <Camera className="w-10 h-10" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-black text-brand-text leading-tight">Quick Scan</h3>
                  <p className="text-sm text-brand-secondary mt-1 font-bold uppercase tracking-tight opacity-60">Verify items instantly</p>
                </div>
              </button>

              {/* Recent Activity Mini-List */}
              <section>
                <div className="flex justify-between items-end mb-4 px-2">
                  <h4 className="font-black text-brand-text uppercase tracking-tighter text-sm">Recent Activity</h4>
                  <button onClick={() => setActiveTab('impact')} className="text-xs font-black text-brand-primary uppercase tracking-widest">View All</button>
                </div>
                <div className="space-y-3">
                  {history.slice(0, 3).map((item) => (
                    <div key={`recent-${item.id}`} className="bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          item.product.accepted ? "bg-brand-accepted/10 text-brand-accepted" : "bg-gray-50 text-gray-400"
                        )}>
                          {item.product.accepted ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-brand-text text-sm tracking-tight">{item.product.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="font-black text-brand-primary tracking-tighter font-serif italic">+${item.product.value.toFixed(2)}</p>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="text-center py-8 opacity-40">
                      <p className="text-sm font-bold uppercase tracking-widest">No scans yet</p>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'scan' && (
            <motion.div 
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black flex flex-col"
            >
              <div className="p-6 flex justify-between items-center text-white relative z-10">
                <button onClick={closeScanner} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                  <X className="w-6 h-6" />
                </button>
                <span className="font-black tracking-[0.2em] text-[10px] uppercase opacity-70">Align Barcode</span>
                <div className="w-10" />
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                <div id="qr-reader" className="w-full h-full max-h-[60vh] !border-none" />
                
                {scanError && (
                  <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 text-center z-50 shadow-2xl">
                    <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                    <p className="text-gray-900 font-bold mb-4">{scanError}</p>
                    <button 
                      onClick={() => setActiveTab('dashboard')}
                      className="bg-brand-primary text-white px-6 py-2 rounded-full font-bold text-xs uppercase"
                    >
                      Go Back
                    </button>
                  </div>
                )}
                
                {/* Visual overlay */}
                <div className="absolute inset-0 pointer-events-none border-[60px] border-black/60 flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-white/20 rounded-[32px] relative">
                    <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-brand-accepted rounded-tl-2xl" />
                    <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-brand-accepted rounded-tr-2xl" />
                    <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-brand-accepted rounded-bl-2xl" />
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-brand-accepted rounded-br-2xl" />
                    
                    {/* Scanning line */}
                    <motion.div 
                      animate={{ top: ['10%', '90%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute left-4 right-4 h-0.5 bg-brand-accepted/50 shadow-[0_0_15px_rgba(136,160,112,0.8)]"
                    />
                  </div>
                </div>
              </div>

              <div className="p-10 mb-20 text-center relative z-10">
                <p className="text-white/80 font-black text-[10px] uppercase tracking-widest">Center the barcode within the frame</p>
                <div className="mt-4 flex justify-center gap-1">
                  {['dot-1', 'dot-2', 'dot-3'].map((key, i) => (
                    <motion.div 
                      key={key}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'impact' && (
            <motion.div 
              key="impact"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center px-2">
                <h2 className="text-2xl font-black text-brand-text tracking-tighter uppercase font-serif italic">Impact Log</h2>
                <button 
                  onClick={() => {if(confirm('Clear history?')) setHistory([]);}}
                  className="text-brand-accent hover:text-red-500 p-2 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-brand-accent/10 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand-primary flex items-center justify-center text-white shadow-lg shadow-brand-primary/10">
                    <History className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-brand-text tracking-tighter font-serif italic">${totalImpact.toFixed(2)}</p>
                    <p className="text-[10px] font-black text-brand-secondary uppercase tracking-widest">Total Lifecycle Value</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pb-4">
                {history.map((item, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={`full-${item.id}`} 
                    className="bg-white p-5 rounded-3xl flex items-center justify-between border border-gray-50 group hover:border-brand-accent transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        item.product.accepted ? "bg-brand-accepted/10 text-brand-accepted" : "bg-amber-50 text-amber-600"
                      )}>
                        {item.product.accepted ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text text-sm tracking-tight">{item.product.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] bg-brand-bg text-brand-secondary px-2 py-0.5 rounded-lg font-black uppercase tracking-widest">{item.product.type}</span>
                          <span className="text-[10px] text-gray-300 font-bold">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-brand-primary tracking-tighter text-lg font-serif italic">+${item.product.value.toFixed(2)}</p>
                    </div>
                  </motion.div>
                ))}
                {history.length === 0 && (
                  <div className="text-center py-20 text-gray-300">
                    <History className="w-16 h-16 mx-auto opacity-10 mb-4" />
                    <p className="font-black uppercase tracking-widest text-xs">No active logs</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'places' && (
            <motion.div 
              key="places"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6 h-full flex flex-col"
            >
              <div className="px-2">
                <h2 className="text-2xl font-black text-brand-text uppercase tracking-tighter font-serif italic">Drop-off Finder</h2>
                <p className="text-xs text-brand-secondary font-medium mt-1">Locate authorized recycling & deposit centers near you.</p>
              </div>
              
              <div className="flex-1 bg-white rounded-[32px] overflow-hidden border border-brand-accent/20 shadow-xl relative min-h-[400px]">
                {process.env.VITE_GOOGLE_MAPS_API_KEY ? (
                  <APIProvider apiKey={process.env.VITE_GOOGLE_MAPS_API_KEY}>
                    <Map
                      center={mapCenter}
                      zoom={mapZoom}
                      onCenterChanged={(ev) => setMapCenter(ev.detail.center)}
                      onZoomChanged={(ev) => setMapZoom(ev.detail.zoom)}
                      mapId={MAP_ID}
                      className="w-full h-full"
                    >
                      {/* Static Verified Locations */}
                      {DEPOSIT_LOCATIONS.map(loc => (
                        <AdvancedMarker 
                          key={loc.id} 
                          position={{ lat: loc.lat, lng: loc.lng }}
                          onClick={() => focusLocation(loc.lat, loc.lng, loc)}
                        >
                          <Pin 
                            background={'#88A070'} 
                            glyphColor={'#FFF'} 
                            borderColor={'#000'} 
                          />
                        </AdvancedMarker>
                      ))}

                      {/* Search Results */}
                      {searchResults.map(loc => (
                        <AdvancedMarker 
                          key={loc.id} 
                          position={{ lat: loc.lat, lng: loc.lng }}
                          onClick={() => focusLocation(loc.lat, loc.lng, loc)}
                        >
                          <Pin 
                            background={'#6B705C'} 
                            glyphColor={'#FFF'} 
                            borderColor={'#000'} 
                          />
                        </AdvancedMarker>
                      ))}
                    </Map>
                  </APIProvider>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center bg-brand-bg/30">
                    <MapPin className="w-12 h-12 text-brand-accent/40 mb-4" />
                    <p className="text-brand-text font-bold italic font-serif">Map integration pending</p>
                    <p className="text-[10px] text-brand-secondary mt-2 leading-relaxed">
                      Please provide a <code className="bg-brand-bg px-1 px-0.5 rounded">VITE_GOOGLE_MAPS_API_KEY</code> in your environment settings to enable the drop-off finder.
                    </p>
                  </div>
                )}
              </div>

              <form onSubmit={handleStoreSearch} className="px-2 relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stores (Whole Foods, Target...)"
                  className="w-full bg-white border border-brand-accent/20 rounded-2xl py-4 px-6 pr-12 text-sm font-bold text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all shadow-sm"
                />
                <button 
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-primary hover:scale-110 transition-transform disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </form>

              <div className="space-y-3">
                <h4 className="font-black text-brand-text text-[10px] uppercase tracking-[0.2em] px-2 opacity-50">
                  {searchResults.length > 0 ? "Search Results" : "Nearby Centers"}
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar px-1">
                  {(searchResults.length > 0 ? searchResults : DEPOSIT_LOCATIONS).map((place) => (
                    <button 
                      key={place.id} 
                      onClick={() => focusLocation(place.lat, place.lng, place)}
                      className="w-full text-left bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm active:scale-[0.98] transition-transform hover:border-brand-primary"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          searchResults.length > 0 ? "bg-brand-bg text-brand-primary" : "bg-brand-primary text-white"
                        )}>
                          {searchResults.length > 0 ? <Navigation className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-brand-text text-sm tracking-tight">{place.name}</p>
                          <p className="text-[10px] text-brand-secondary font-black uppercase tracking-widest">{place.address} • {place.status}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-brand-accent/40" />
                    </button>
                  ))}
                  {searchResults.length === 0 && DEPOSIT_LOCATIONS.length === 0 && (
                    <div className="text-center py-8 opacity-40">
                      <MapPin className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Enter a store name above</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Location Detail Overlay */}
              <AnimatePresence>
                {selectedLocation && (
                  <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="absolute inset-x-0 bottom-0 z-30 p-4"
                  >
                    <div className="bg-white rounded-[40px] shadow-2xl border border-brand-accent/10 p-6 relative overflow-hidden">
                      <button 
                        onClick={() => setSelectedLocation(null)}
                        className="absolute right-6 top-6 p-2 bg-brand-bg rounded-full text-brand-secondary hover:text-brand-text transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      <div className="space-y-6">
                        <div className="flex items-start gap-4 pr-10">
                          <div className="w-14 h-14 rounded-3xl bg-brand-primary flex items-center justify-center text-white shrink-0">
                            <MapPin className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-brand-text italic font-serif leading-tight">{selectedLocation.name}</h3>
                            <p className="text-xs text-brand-secondary font-bold uppercase tracking-tight mt-1">{selectedLocation.address}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-brand-bg/50 rounded-2xl p-4 border border-brand-accent/5">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="w-3 h-3 text-brand-primary" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-brand-secondary">Hours</span>
                            </div>
                            <p className="text-xs font-bold text-brand-text">{selectedLocation.hours || "Consult store website"}</p>
                          </div>
                          <a 
                            href={selectedLocation.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-brand-primary/5 rounded-2xl p-4 border border-brand-primary/10 flex flex-col justify-center group active:scale-95 transition-transform"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Globe className="w-3 h-3 text-brand-primary" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-brand-secondary">Website</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-brand-primary italic font-serif underline decoration-brand-primary/20">Visit Store</span>
                              <ExternalLink className="w-3 h-3 text-brand-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </div>
                          </a>
                        </div>

                        {selectedLocation.tips && (
                          <div className="bg-brand-accepted/5 rounded-2xl p-4 border border-brand-accepted/10">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="w-3 h-3 text-brand-accepted" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-brand-accepted">Community Tip</span>
                            </div>
                            <p className="text-xs text-brand-text leading-relaxed italic font-medium">"{selectedLocation.tips}"</p>
                          </div>
                        )}
                        
                        {!selectedLocation.tips && (
                          <div className="py-4 text-center border-t border-brand-bg">
                            <p className="text-[10px] text-brand-secondary font-bold uppercase tracking-widest opacity-40 italic">No community tips yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-xl border-t border-gray-100 px-8 py-4 safe-bottom flex justify-between items-center z-40">
        {[
          { id: 'dashboard', icon: Leaf, label: 'Core' },
          { id: 'scan', icon: Camera, label: 'Scan', special: true },
          { id: 'impact', icon: History, label: 'Log' },
          { id: 'places', icon: MapPin, label: 'Drop-off' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => item.id === 'scan' ? startScanner() : setActiveTab(item.id as Tab)}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all duration-500 group",
              item.special && "-mt-12",
              activeTab === item.id ? "text-brand-primary" : "text-brand-accent/40"
            )}
          >
            <div className={cn(
              "transition-all duration-500 flex items-center justify-center",
              item.special ? "w-20 h-20 rounded-full bg-brand-primary text-white shadow-2xl shadow-brand-primary/20 border-8 border-brand-bg group-active:scale-90" : "w-12 h-12",
              !item.special && activeTab === item.id && "bg-brand-bg rounded-[20px]"
            )}>
              <item.icon className={cn(item.special ? "w-8 h-8" : "w-6 h-6")} />
            </div>
            {!item.special && <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Result Modal / Bottom Sheet */}
      <AnimatePresence>
        {showResult && scannedProduct && (
          <div key="result-modal-overlay" className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResult(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              key="result-modal-content"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 200 }}
              className="relative bg-white w-full max-w-md rounded-t-[50px] p-10 pb-14 shadow-2xl z-10"
            >
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-14 h-1.5 bg-gray-100 rounded-full" />
              
              <div className="flex justify-between items-start mb-10">
                <div className="flex flex-wrap gap-2">
                  <div className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2",
                    scannedProduct.accepted ? "bg-brand-accepted text-white" : "bg-brand-accent text-white"
                  )}>
                    {scannedProduct.accepted ? (
                      <><CheckCircle2 className="w-4 h-4" /> Accepted</>
                    ) : (
                      <><AlertTriangle className="w-4 h-4" /> Restricted</>
                    )}
                  </div>
                  {scannedProduct.value === 0.05 && (
                    <div className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] bg-brand-primary text-white flex items-center gap-2 shadow-lg shadow-brand-primary/20">
                      <MapPin className="w-3 h-3" /> NYC 5¢ Deposit
                    </div>
                  )}
                </div>
                <button onClick={() => setShowResult(false)} className="text-gray-200 hover:text-gray-900 transition-colors p-2 shrink-0">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex items-center gap-8 mb-10">
                <div className={cn(
                  "w-28 h-28 rounded-[36px] flex items-center justify-center shrink-0 shadow-inner",
                  scannedProduct.accepted ? "bg-brand-primary text-white" : "bg-brand-bg text-brand-accent"
                )}>
                  {scannedProduct.accepted ? <CheckCircle2 className="w-14 h-14" /> : <AlertTriangle className="w-14 h-14" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-black text-brand-text leading-none tracking-tighter">{scannedProduct.name}</h3>
                  <div className="flex items-center gap-2 mt-3 text-brand-secondary">
                    <span className="text-[10px] font-black uppercase tracking-widest">{scannedProduct.brand}</span>
                    <span className="w-1 h-1 rounded-full bg-brand-accent/30" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{scannedProduct.type}</span>
                  </div>
                  <p className="text-brand-primary font-black text-3xl mt-4 tracking-tighter font-serif italic">${scannedProduct.value.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-5 p-6 bg-brand-bg rounded-[32px] border border-brand-accent/10 relative overflow-hidden">
                  <Info className="w-8 h-8 text-brand-primary shrink-0 relative z-10" />
                  <p className="text-sm font-bold text-brand-text leading-relaxed italic relative z-10 font-serif line-clamp-2">
                    "{scannedProduct.instructions}"
                  </p>
                  <History className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-20 -rotate-12" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setShowDetails(true)}
                    className="bg-brand-bg text-brand-primary font-black py-6 rounded-[32px] text-[10px] uppercase tracking-[0.2em] border border-brand-accent/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    View Details
                  </button>
                  <button 
                    onClick={() => setShowResult(false)}
                    className="bg-brand-primary text-white font-black py-6 rounded-[32px] text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-brand-primary/10 active:scale-95 transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showDetails && scannedProduct && (
          <div key="details-modal-overlay" className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetails(false)}
              className="absolute inset-0 bg-brand-text/90 backdrop-blur-xl"
            />
            <motion.div 
              key="details-modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-8 pb-4 shrink-0 flex justify-between items-center">
                <h3 className="text-xl font-black text-brand-text uppercase tracking-tighter font-serif italic">Inventory Specs</h3>
                <button onClick={() => setShowDetails(false)} className="bg-brand-bg p-2 rounded-full text-brand-secondary hover:text-brand-text transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-4 space-y-8 custom-scrollbar">
                {/* Product Bio */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-brand-bg flex items-center justify-center text-brand-primary">
                      <Leaf className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-secondary">Full Designation</p>
                      <p className="text-lg font-bold text-brand-text leading-tight">{scannedProduct.name}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-brand-bg/50 p-4 rounded-3xl border border-brand-accent/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-brand-secondary">Brand</p>
                      <p className="text-sm font-bold text-brand-text">{scannedProduct.brand}</p>
                    </div>
                    <div className="bg-brand-bg/50 p-4 rounded-3xl border border-brand-accent/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-brand-secondary">Category</p>
                      <p className="text-sm font-bold text-brand-text">{scannedProduct.type}</p>
                    </div>
                  </div>
                </div>

                {/* Eco Impact Details */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary mb-4">Recycling Protocol</h4>
                  <div className="bg-white border border-brand-accent/10 rounded-[32px] p-6 shadow-sm">
                    <p className="text-sm font-medium text-brand-text leading-relaxed tracking-tight italic font-serif">
                       "{scannedProduct.instructions}"
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {[
                      { label: "Barcode ID", value: scannedProduct.barcode },
                      { label: "Deposit Eligible", value: scannedProduct.accepted ? "YES (NYC Verified)" : "NO" },
                      { label: "Refund Value", value: `$${scannedProduct.value.toFixed(2)}` }
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-secondary/60">{item.label}</span>
                        <span className="text-xs font-bold text-brand-text">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Materials Fact */}
                <div className="bg-brand-primary/5 rounded-[32px] p-6 border border-brand-primary/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-primary text-white flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Environmental Insight</p>
                  </div>
                  <p className="text-[11px] font-medium text-brand-secondary leading-relaxed italic font-serif">
                    {scannedProduct.type === 'Aluminum' ? "Aluminum is infinitely recyclable. Recycling a single can saves 95% of the energy needed to make a new one." : 
                     scannedProduct.type === 'Plastic' ? "PET plastics (like this one) are highly valuable in the circular economy when properly cleaned." :
                     "Properly sorting mixed materials helps prevent entire batches of recycling from state-level contamination."}
                  </p>
                </div>
              </div>

              <div className="p-8 pt-4 shrink-0">
                <button 
                  onClick={() => setShowDetails(false)}
                  className="w-full bg-brand-primary text-white font-black py-5 rounded-[28px] text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20 active:scale-95 transition-all"
                >
                  Return to Scan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
