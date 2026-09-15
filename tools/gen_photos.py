#!/usr/bin/env python3
"""Генерация фото макета ПРОМКОНТУР через Arion HUB (gpt-image-2), ключ ~/.claude/secrets/arionhub.env.
Запуск: python3 tools/gen_photos.py [--only name1,name2]  — пропускает уже готовые."""
import sys, os, concurrent.futures as cf, time
sys.path.insert(0, os.path.dirname(__file__))
from imggen_arion import gen

OUT = os.path.join(os.path.dirname(__file__), "..", "project", "img", "src")
STYLE = ("Real documentary photograph, shot on Sony A7R IV with 35mm f/2.8 lens, natural industrial lighting, "
         "subtle film grain across the whole frame including background, true-to-life colors, slight wear, new but not sterile. "
         "No text overlays, no watermarks, no brand logos, no readable brand names, blank nameplates only. "
         "Not a 3D render, not octane, not keyshot, not blender, not CGI, not illustration.")
PRODUCT = ("Catalog packshot product photo on a pure white seamless background #FFFFFF, even soft light, "
           "subtle soft contact shadow directly under the object, object centered with generous margin. ")
# Для товарных снимков без «зерна по фону»: фон должен остаться ровно белым
STYLE_PRODUCT = ("Real product photograph, shot on a medium format camera with a macro-capable lens, true-to-life colors and materials, "
                 "clean pure white background with no grain, no gradient, no vignette. "
                 "No text overlays, no watermarks, no brand logos, no readable brand names, blank nameplates only. "
                 "Not a 3D render, not CGI, not illustration.")

T = {  # name: (size, prompt)
 "warehouse": ("1536x1024", "Industrial equipment distribution warehouse interior: tall pallet racks with boxed centrifugal pumps, electric motors and valves on wooden pallets, a forklift in the aisle, LED high-bay lights, concrete floor."),
 "p-cr32": ("1024x1024", PRODUCT + "Vertical multistage inline centrifugal pump, stainless steel pump stack with tie rods, blue-painted cast iron base with two flanged inlet/outlet ports, blue electric motor on top, blank metal nameplate."),
 "p-nb40": ("1024x1024", PRODUCT + "End-suction single-stage close-coupled centrifugal pump on a steel baseplate, blue-painted cast iron volute casing with flanges, coupled to a blue electric motor, blank nameplate."),
 "p-nis80": ("1024x1024", PRODUCT + "Horizontal end-suction centrifugal water pump, grey-green painted cast iron volute with flanged suction and discharge, electric motor, compact baseplate, blank nameplate."),
 "p-lgcy75": ("1536x1024", PRODUCT + "Large skid-mounted industrial rotary screw air compressor, 75 kW, rectangular painted steel enclosure in blue and white with ventilation grilles, control panel with small screen, steel skid frame."),
 "p-vr15": ("1024x1024", PRODUCT + "Industrial variable frequency drive, 15 kW, wall-mount plastic and metal housing, dark grey with small keypad and LED display, cable glands at the bottom, heatsink fins on the side."),
 "p-6205": ("1024x1024", PRODUCT + "Deep groove ball bearing with two rubber seals, 25 mm bore, polished steel outer ring, black seals, lying at an angle, a second identical bearing behind it slightly out of focus."),
 "brand": ("1536x1024", "Showroom corner of an industrial pump manufacturer: several blue vertical multistage pumps and a booster set on display stands, clean grey floor, neutral wall without any logos."),
 "dir-pumps": ("1536x1024", "Water pumping station interior: row of three blue vertical multistage pumps on concrete plinths, painted steel manifolds, gate valves, pressure gauges, control cabinet in background."),
 "blog-boiler": ("1536x1024", "Boiler room pump group: twin inline circulation pumps with red painted pipework, insulated pipes, butterfly valves, pressure gauges, industrial gas boiler in the background."),
 "a-compressor": ("1536x1024", "Rotary screw air compressor in a factory compressor room, enclosure door open showing airend and motor, air receiver tank beside it."),
 "a-bearing": ("1536x1024", "Close-up of a mechanic's gloved hands holding a worn roller bearing next to a disassembled bearing housing on a workbench, visible wear marks on the raceway."),
 "a-motor": ("1536x1024", "Cast iron three-phase asynchronous electric motor, foot-mounted, grey paint with cooling fins and terminal box, on a workshop floor pallet."),
 "a-vfd": ("1536x1024", "Open electrical control cabinet with variable frequency drives mounted on DIN rails, neat wiring ducts, contactors and circuit breakers, industrial plant."),
 "a-valves": ("1536x1024", "Pipeline assembly in a plant: flanged gate valve, butterfly valve with gear operator and globe control valve on steel pipes with bolts and gaskets."),
 "a-air": ("1536x1024", "Compressed air treatment station: refrigerated air dryer, line filters with drains, vertical galvanized air receiver tank, piping on the wall of a factory."),
 "a-hex": ("1536x1024", "Industrial plate heat exchanger with steel frame and clamping bolts, stack of corrugated plates visible, connected to insulated pipes in a heating substation."),
 "a-water": ("1536x1024", "Industrial water treatment unit in a boiler house: blue fiberglass softener vessels, reverse osmosis membrane housings on a steel rack, brine tank."),
 "a-containers": ("1536x1024", "Port container terminal yard with stacked shipping containers, a gantry crane and wooden crates of industrial machinery being unloaded, overcast daylight."),
 "art-hero": ("1536x1024", "Pump group in a technical room, focus on pressure gauges mounted on the discharge pipes of centrifugal pumps, red and silver painted piping, shallow depth of field."),
 "art-vfd": ("1536x1024", "Wall-mounted electrical cabinet with a frequency inverter controlling a pump, cabinet door open, cables and labels without readable text, industrial pump in background."),
 "nameplate": ("1024x1024", "Close-up phone camera view of a worn metal nameplate riveted to a blue pump motor housing, engraved rows of technical parameters (unreadable small text), slight glare, shallow depth of field."),
 "c-seal": ("1536x1024", "Close-up of a pump mechanical seal assembly on a workbench: carbon and ceramic seal faces, springs and O-rings, next to a disassembled pump shaft, oily fingerprints."),
 "c-gearmotor": ("1536x1024", "Industrial helical gear motor, grey painted cast housing with foot mounting and output shaft with key, next to a separate gearbox and electric motor coupled on a steel frame, workshop."),
 "c-materials": ("1536x1024", "Three industrial ball valves side by side on a steel table: grey cast iron flanged valve, polished stainless steel valve, grey PVC plastic valve, neutral workshop background."),
 "c-cavitation": ("1536x1024", "Close-up of a worn bronze centrifugal pump impeller with cavitation pitting damage on the vanes, held on a workshop bench next to calipers."),
 "hero-pump-hall": ("1536x1024", "Wide interior of a large industrial pumping and compressor hall seen from a raised walkway: rows of blue centrifugal pumps on concrete plinths, painted steel pipelines with gate valves, an electric control cabinet row along the wall, a screw compressor in the far end. Deep perspective, cool daylight from high windows mixed with LED high-bay lights, no people. Left third of the frame calm and darker for text overlay. No logos, no brand names, no readable text; blank nameplates."),
 "cl-mechanics": ("1536x1024", "Workshop bench in a plant repair shop: an opened helical gearbox with visible gears, a pile of roller and ball bearings, V-belts, a roller chain, lip seals and couplings laid out neatly on a steel bench, overhead fluorescent light, slightly oily surfaces. No logos, no brand names, no readable text; blank nameplates."),
 "cl-production": ("1536x1024", "Metalworking shop floor: a CNC turning centre with its sliding door open and coolant on a turned steel part, a robotic welding cell with a yellow articulated arm behind a safety fence in the background, sparks subtle, cool machine lighting, no people. No logos, no brand names, no readable text; blank nameplates."),
 "cl-logistics": ("1536x1024", "Food and packaging production line: stainless steel conveyor with shrink-wrapped cartons moving to an automatic stretch-wrapping machine, a pallet with finished goods and a pallet stacker nearby, bright clean hall, cool white light, no people. No logos, no brand names, no readable text; blank nameplates."),
 "about-engineer": ("1536x1024", "Over-the-shoulder view of a procurement engineer in a dark work jacket holding a tablet next to a running pump unit in a plant, face not visible, the tablet screen shows abstract table rows without readable text, pipes and gauges softly out of focus. No logos, no brand names, no readable text; blank nameplates."),
 "payment-dispatch": ("1536x1024", "Loading dock of a supplier warehouse: a centrifugal pump crated in a wooden frame and a wrapped pallet of boxes being loaded into a box truck by a pallet jack, dock leveller, overcast daylight mixed with warehouse light, no faces. No logos, no brand names, no readable text; blank nameplates."),
 "warranty-inspection": ("1536x1024", "Service technician's gloved hand holding a handheld vibration analyzer probe against the bearing housing of an electric motor driving a pump, blank analyzer screen, plant background softly blurred, focused practical light, face not visible. No logos, no brand names, no readable text; blank nameplates."),
 "project-commissioning": ("1536x1024", "Newly installed booster pumping station on a skid in a plant: three vertical multistage pumps, stainless manifolds, a control cabinet with variable frequency drives, fresh paint, protective film on the cabinet door, commissioning tools on the floor, bright work light, no people. No logos, no brand names, no readable text; blank nameplates."),
 "nameplate-phone": ("1536x1024", "Hand holding a smartphone in front of a worn blue electric pump motor in a plant, phone camera view framing the riveted metal nameplate with a rectangular focus frame on screen, nameplate engraving unreadable, shallow depth of field. No logos, no brand names, no readable text; blank nameplates."),
 "supplier-dock": ("1536x1024", "Distributor warehouse with a truck at the loading dock, pallets of boxed industrial valves and electric motors being staged, a worker with a handheld barcode scanner seen from behind, high racks, LED light, deep perspective. No logos, no brand names, no readable text; blank nameplates."),
 "supplier-stock-count": ("1536x1024", "Close view of a warehouse rack aisle: a gloved hand scanning a blank barcode label on a box containing a gear motor with a rugged handheld terminal, shelves with boxed bearings and pumps behind, cool light, shallow depth of field. No logos, no brand names, no readable text; blank nameplates."),
 "p-cr32-flange": ("1024x1024", PRODUCT + "close-up of the blue cast iron base of a vertical multistage pump showing the inline flanged inlet and outlet ports with bolt holes and the stainless steel sleeve above. No logos, no brand names, no readable text; blank nameplates."),
 "p-cr32-motor": ("1024x1024", PRODUCT + "upper part of a vertical multistage pump, blue electric motor with cooling fins, terminal box and a blank riveted metal nameplate, coupling guard below. No logos, no brand names, no readable text; blank nameplates."),
 "p-check-valve": ("1024x1024", PRODUCT + "Flanged swing check valve DN65 PN16, grey-blue painted cast iron body with two round bolted flanges and a bolted cover on top, cast direction arrow on the body, no text."),
 "p-gasket-kit": ("1024x1024", PRODUCT + "Set of flange gaskets DN65 for a pump: several flat black rubber and grey paronite ring gaskets of the same size stacked and fanned out, with a small bag of galvanized bolts and nuts next to them."),
 "p-lip-seal": ("1024x1024", PRODUCT + "Several black NBR rotary shaft lip seals (radial oil seals) 45x65x10 mm with visible metal spring inside the lip, one standing on edge, others lying flat, macro product photo."),
 "p-gearmotor": ("1024x1024", PRODUCT + "Compact helical gear motor, grey painted aluminium gearbox housing with foot mounting and solid output shaft with key, small grey three-phase electric motor attached, blank nameplate."),
 "p-cnp-cdlf": ("1024x1024", PRODUCT + "Vertical multistage stainless steel centrifugal pump of CDLF type: tall polished silver stainless steel pump stack with tie rods, stainless base with two inline flanged ports, grey electric motor on top, blank nameplate, no logos."),
 "p-wilo-helix": ("1024x1024", PRODUCT + "Vertical multistage inline centrifugal pump: red-painted electric motor and red-painted cast iron base with inline flanges, brushed stainless steel pump stack between them with tie rods, blank nameplate, no logos, no brand names."),
 "p-ebara-3m": ("1024x1024", PRODUCT + "End-suction close-coupled stainless steel centrifugal pump: polished stainless steel volute casing with threaded or flanged suction and discharge ports, grey electric motor with cooling fins, compact feet, blank nameplate, no logos."),
 "p-air-filter": ("1024x1024", PRODUCT + "Cylindrical pleated compressed-air filter element with white pleated media, grey plastic end caps and black O-ring, standing upright, second one lying behind."),
 "p-vibro-mount": ("1024x1024", PRODUCT + "Set of four anti-vibration rubber mounts with M12 threaded studs: cylindrical black rubber bodies bonded between two zinc-plated steel plates, one standing, others lying, with nuts and washers."),
}

def job(name):
    size, prompt = T[name]
    path = os.path.join(OUT, name + ".png")
    if os.path.exists(path): return name, "skip"
    for a in range(4):
        try:
            gen(prompt + " " + (STYLE_PRODUCT if name.startswith("p-") else STYLE), path, size=size, tries=1); return name, "ok"
        except Exception as e:
            err = str(e)[:160]; time.sleep(5 * (a + 1))
    return name, "FAIL " + err

if __name__ == "__main__":
    names = list(T)
    for arg in sys.argv[1:]:
        if arg.startswith("--only="): names = arg[7:].split(",")
    with cf.ThreadPoolExecutor(4) as ex:
        for n, st in ex.map(job, names): print(n, st, flush=True)
