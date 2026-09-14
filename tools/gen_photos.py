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
PRODUCT = ("Catalog product photo on a light grey seamless studio backdrop, soft key light from upper left, "
           "nearly black contact shadow under the base, object centered with margin. ")

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
}

def job(name):
    size, prompt = T[name]
    path = os.path.join(OUT, name + ".png")
    if os.path.exists(path): return name, "skip"
    for a in range(4):
        try:
            gen(prompt + " " + STYLE, path, size=size, tries=1); return name, "ok"
        except Exception as e:
            err = str(e)[:160]; time.sleep(5 * (a + 1))
    return name, "FAIL " + err

if __name__ == "__main__":
    names = list(T)
    for arg in sys.argv[1:]:
        if arg.startswith("--only="): names = arg[7:].split(",")
    with cf.ThreadPoolExecutor(4) as ex:
        for n, st in ex.map(job, names): print(n, st, flush=True)
