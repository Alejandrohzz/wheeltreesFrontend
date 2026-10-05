// Modelos más comunes en Colombia por marca.
// Si una marca es 'Otra' (o no está aquí), la pantalla muestra un campo de texto libre.

export const MODELOS_CARRO: Record<string, string[]> = {
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'],
  'BMW': ['Serie 1', 'Serie 2', 'Serie 3', 'Serie 5', 'X1', 'X3', 'X5', 'X6', 'iX3'],
  'BYD': ['Dolphin', 'Seagull', 'Yuan Plus', 'Song Plus', 'Seal', 'Tang', 'Han'],
  'Changan': ['CS15', 'CS35 Plus', 'CS55 Plus', 'CS75 Plus', 'Alsvin', 'Hunter', 'UNI-T'],
  'Chery': ['Tiggo 2', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Arrizo 5', 'Omoda 5'],
  'Chevrolet': ['Spark', 'Spark GT', 'Beat', 'Sail', 'Onix', 'Joy', 'Tracker', 'Captiva', 'Equinox', 'Groove', 'Traverse', 'Tahoe', 'D-Max', 'Colorado', 'N300', 'Aveo', 'Cruze', 'Sonic'],
  'Citroën': ['C3', 'C3 Aircross', 'C4 Cactus', 'C4', 'C5 Aircross', 'Berlingo'],
  'Dodge': ['Journey', 'Durango', 'Charger', 'Challenger', 'Ram 1500'],
  'DFSK': ['Glory 500', 'Glory 580', 'Glory 560', 'C31', 'K01'],
  'Fiat': ['Mobi', 'Uno', 'Argo', 'Cronos', 'Pulse', 'Fastback', 'Strada', 'Toro', '500'],
  'Ford': ['Fiesta', 'Focus', 'Fusion', 'Ecosport', 'Escape', 'Territory', 'Explorer', 'Edge', 'Bronco Sport', 'Ranger', 'F-150', 'Mustang'],
  'Great Wall': ['Poer', 'Wingle 5', 'Haval H6', 'Haval Jolion', 'Haval H2'],
  'Honda': ['Fit', 'City', 'Civic', 'Accord', 'HR-V', 'CR-V', 'WR-V', 'Pilot', 'BR-V'],
  'Hyundai': ['i10', 'Grand i10', 'Accent', 'Elantra', 'Tucson', 'Creta', 'Santa Fe', 'Kona', 'Venue', 'Palisade', 'HB20', 'Ioniq 5'],
  'JAC': ['J2', 'J4', 'JS2', 'JS3', 'JS4', 'JS6', 'T8', 'T6', 'Sunray'],
  'Jeep': ['Renegade', 'Compass', 'Wrangler', 'Grand Cherokee', 'Gladiator', 'Commander'],
  'Kia': ['Picanto', 'Rio', 'Soluto', 'Cerato', 'Sonet', 'Seltos', 'Sportage', 'Sorento', 'Niro', 'Carnival', 'Stonic', 'EV6'],
  'KGM (SsangYong)': ['Tivoli', 'Korando', 'Torres', 'Rexton', 'Musso'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Sport', 'Evoque', 'Velar'],
  'Mazda': ['Mazda 2', 'Mazda 3', 'Mazda 6', 'CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-9', 'MX-5', 'BT-50'],
  'Mercedes-Benz': ['Clase A', 'Clase C', 'Clase E', 'CLA', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'Sprinter'],
  'MG': ['MG 3', 'MG 5', 'MG ZS', 'MG HS', 'MG RX5', 'MG One', 'MG4', 'MG T60'],
  'Mini': ['Cooper', 'Countryman', 'Clubman', 'Cooper SE'],
  'Mitsubishi': ['Mirage', 'Attrage', 'Outlander', 'ASX', 'Eclipse Cross', 'Montero Sport', 'L200', 'Xpander'],
  'Nissan': ['March', 'Versa', 'Sentra', 'Kicks', 'Qashqai', 'X-Trail', 'Pathfinder', 'Frontier', 'Leaf', 'Murano', 'Tiida', 'Note'],
  'Peugeot': ['208', '301', '2008', '3008', '5008', 'Partner', 'Rifter', 'Expert'],
  'Renault': ['Kwid', 'Sandero', 'Stepway', 'Logan', 'Duster', 'Oroch', 'Captur', 'Koleos', 'Kardian', 'Arkana', 'Megane', 'Symbol', 'Clio', 'Twingo'],
  'Seat': ['Ibiza', 'León', 'Arona', 'Ateca', 'Tarraco'],
  'Skoda': ['Fabia', 'Rapid', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq'],
  'Subaru': ['Impreza', 'XV', 'Crosstrek', 'Forester', 'Outback', 'Legacy', 'WRX'],
  'Suzuki': ['Alto', 'Celerio', 'Swift', 'Baleno', 'Dzire', 'Ciaz', 'Ignis', 'Vitara', 'S-Cross', 'Jimny', 'Grand Vitara', 'Ertiga', 'XL7'],
  'Toyota': ['Yaris', 'Corolla', 'Corolla Cross', 'Camry', 'Prius', 'RAV4', 'Land Cruiser', 'Prado', 'Fortuner', 'Hilux', 'Hiace', 'Avanza', 'Rush', 'Raize', 'Etios', 'C-HR', 'Sequoia', 'Tacoma'],
  'Volkswagen': ['Gol', 'Polo', 'Virtus', 'Jetta', 'Golf', 'Passat', 'T-Cross', 'Nivus', 'Taos', 'Tiguan', 'Touareg', 'Amarok', 'Saveiro', 'ID.4'],
  'Volvo': ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60', 'EX30', 'C40'],
};

export const MODELOS_MOTO: Record<string, string[]> = {
  'AKT': ['NKD 125', 'TT 125', 'CR4 125', 'CR5 180', 'Dynamic Pro', 'Evo NR', 'RTX 150', 'Special 125', 'AK 125 Flex', 'Jet 4', 'Silver 115', 'EVO 125'],
  'Bajaj': ['Boxer CT 100', 'Boxer CT 125', 'Platina 100', 'Discover 125', 'Pulsar NS 125', 'Pulsar NS 160', 'Pulsar NS 200', 'Pulsar N250', 'Pulsar 180', 'Dominar 250', 'Dominar 400', 'Avenger 220'],
  'Benelli': ['TNT 15', 'TNT 25', 'TNT 300', 'TNT 600', 'Leoncino 250', 'Leoncino 500', 'TRK 251', 'TRK 502', 'Imperiale 400'],
  'BMW': ['G 310 R', 'G 310 GS', 'F 750 GS', 'F 850 GS', 'R 1250 GS', 'S 1000 RR', 'R nineT'],
  'Ducati': ['Monster', 'Scrambler', 'Multistrada', 'Panigale V2', 'Panigale V4', 'Streetfighter', 'Diavel', 'DesertX'],
  'Hero': ['Hunk 160R', 'Xpulse 200', 'Xtreme 160R', 'Eco Deluxe', 'Ignitor 125', 'Splendor', 'Dash 110', 'Pleasure'],
  'Honda': ['CB 125F', 'CB 160F', 'CB 190R', 'CB 300F', 'CBR 250R', 'CBR 500R', 'XR 150L', 'XR 190L', 'XRE 190', 'XRE 300', 'Africa Twin', 'Navi', 'Biz 125', 'Wave 110', 'CRF 250', 'PCX 160', 'Elite 125', 'Dio'],
  'Kawasaki': ['Z400', 'Z650', 'Z900', 'Ninja 400', 'Ninja 650', 'Ninja ZX-6R', 'Versys 300', 'Versys 650', 'KLX 150', 'KLX 230', 'Vulcan S'],
  'KTM': ['Duke 200', 'Duke 250', 'Duke 390', 'Duke 790', 'RC 200', 'RC 390', 'Adventure 250', 'Adventure 390', 'Adventure 890', 'EXC 300'],
  'Kymco': ['Agility 125', 'Agility City 150', 'Like 150', 'Twist 125', 'Super 8', 'Downtown 300', 'AK 550', 'Xciting 400', 'MXU 300'],
  'Piaggio': ['Liberty', 'Fly 125', 'Medley 150', 'Beverly 300', 'MP3', 'Zip'],
  'Royal Enfield': ['Classic 350', 'Meteor 350', 'Hunter 350', 'Bullet 350', 'Himalayan', 'Scram 411', 'Interceptor 650', 'Continental GT 650', 'Super Meteor 650'],
  'Suzuki': ['GN 125', 'Gixxer 150', 'Gixxer 250', 'Gixxer SF', 'AX4', 'Address', 'Burgman 125', 'Burgman 200', 'DR 150', 'DR 650', 'V-Strom 250', 'V-Strom 650', 'V-Strom 1050', 'GSX-S750', 'Hayabusa', 'Intruder 150'],
  'Triumph': ['Speed 400', 'Scrambler 400 X', 'Street Triple', 'Speed Triple', 'Trident 660', 'Tiger 660', 'Tiger 900', 'Tiger 1200', 'Bonneville T100', 'Bonneville T120', 'Rocket 3'],
  'TVS': ['Apache RTR 160', 'Apache RTR 160 4V', 'Apache RTR 180', 'Apache RTR 200', 'Apache RR 310', 'Raider 125', 'Ntorq 125', 'Sport 100', 'StaR City', 'Jupiter', 'Ronin'],
  'Vespa': ['Primavera 150', 'Sprint 150', 'GTS 300', 'LX 150', 'Elettrica'],
  'Victory': ['Vegas', 'Hammer', 'Cross Country', 'Gunner', 'Octane'],
  'Yamaha': ['FZ 150', 'FZ 250', 'FZ-S', 'FZ25', 'MT-03', 'MT-07', 'MT-09', 'R15', 'R3', 'YZF-R6', 'XTZ 125', 'XTZ 150', 'XTZ 250', 'Tenere 250', 'Tenere 700', 'Crypton', 'Libero 125', 'NMAX', 'XMAX 300', 'Fazer 250', 'FZ16', 'Ray ZR', 'Fascino', 'BWS 125'],
  'Zontes': ['ZT 125', 'ZT 155 U', 'ZT 310 T', 'ZT 310 R', 'ZT 350 T', 'ZT 350 X', 'ZT 703 F'],
};

export function modelosPorMarca(tipo: 'MOTO' | 'CARRO', marca: string): string[] {
  const catalogo = tipo === 'MOTO' ? MODELOS_MOTO : MODELOS_CARRO;
  return catalogo[marca] ?? [];
}
