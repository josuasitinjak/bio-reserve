#include <Arduino.h>

const int PIN_MPX5010DP = 34;
const int PIN_PZEM_RX   = 16;
const int PIN_PZEM_TX   = 17;

const int RELAY_POMPA   = 25;
const int RELAY_CHILLER = 26;
const int RELAY_LAMPU   = 27;
const int RELAY_KIPAS   = 14;

#define RELAY_ON   LOW
#define RELAY_OFF  HIGH

const float K_FACTOR           = 0.6544;
const float KAPASITAS_TANGKI   = 100.0;
const float THRESHOLD_SHEDDING = 25.0;
const float THRESHOLD_RECOVERY = 27.0;

const float ADC_VREF           = 3.30;
const int   ADC_RESOLUTION     = 4095;
const float TEKANAN_MAKS_KPA   = 10.0;

struct TelemetriEnergi {
  float teganganV;
  float arusA;
  float dayaAktifW;
  float tekananKPa;
  float volumeLiter;
  float socPersen;
  float sisaEnergiWh;
  float durasiMenit;
  bool  modeShedding;
};

TelemetriEnergi dataSistem;
unsigned long waktuSebelumnya = 0;
const unsigned long INTERVAL_UPDATE_MS = 2000;

float bacaTekananGas() {
  long akumulasiAdc = 0;
  for (int i = 0; i < 20; i++) {
    akumulasiAdc += analogRead(PIN_MPX5010DP);
    delayMicroseconds(150);
  }
  float rataAdc = (float)akumulasiAdc / 20.0;
  float teganganAdc = (rataAdc / (float)ADC_RESOLUTION) * ADC_VREF;
  float tekanan = (teganganAdc / ADC_VREF) * TEKANAN_MAKS_KPA;
  if (tekanan < 0.0) tekanan = 0.0;
  if (tekanan > TEKANAN_MAKS_KPA) tekanan = TEKANAN_MAKS_KPA;
  return tekanan;
}

void bacaSensorDaya(float &tegangan, float &arus, float &daya) {
  tegangan = 220.4;
  float dayaTerhitung = 100.0;
  if (digitalRead(RELAY_LAMPU) == RELAY_ON) dayaTerhitung += 300.0;
  if (digitalRead(RELAY_KIPAS) == RELAY_ON) dayaTerhitung += 300.0;
  daya = dayaTerhitung;
  arus = daya / tegangan;
}

void prosesManajemenEnergi() {
  dataSistem.tekananKPa = bacaTekananGas();
  dataSistem.volumeLiter = (dataSistem.tekananKPa / TEKANAN_MAKS_KPA) * KAPASITAS_TANGKI;
  dataSistem.socPersen = (dataSistem.volumeLiter / KAPASITAS_TANGKI) * 100.0;
  dataSistem.sisaEnergiWh = dataSistem.volumeLiter * K_FACTOR;

  digitalWrite(RELAY_POMPA, RELAY_ON);
  digitalWrite(RELAY_CHILLER, RELAY_ON);

  if (dataSistem.socPersen <= THRESHOLD_SHEDDING) {
    digitalWrite(RELAY_LAMPU, RELAY_OFF);
    digitalWrite(RELAY_KIPAS, RELAY_OFF);
    dataSistem.modeShedding = true;
  } else if (dataSistem.socPersen >= THRESHOLD_RECOVERY) {
    digitalWrite(RELAY_LAMPU, RELAY_ON);
    digitalWrite(RELAY_KIPAS, RELAY_ON);
    dataSistem.modeShedding = false;
  }

  bacaSensorDaya(dataSistem.teganganV, dataSistem.arusA, dataSistem.dayaAktifW);
  float dayaEfektif = max(10.0f, dataSistem.dayaAktifW);
  dataSistem.durasiMenit = (dataSistem.sisaEnergiWh / dayaEfektif) * 60.0;
}

void kirimDataTelemetri() {
  Serial.print(F("JSON:{\"soc\":"));
  Serial.print(dataSistem.socPersen, 1);
  Serial.print(F(",\"press\":"));
  Serial.print(dataSistem.tekananKPa, 2);
  Serial.print(F(",\"energy\":"));
  Serial.print(dataSistem.sisaEnergiWh, 1);
  Serial.print(F(",\"power\":"));
  Serial.print(dataSistem.dayaAktifW, 0);
  Serial.print(F(",\"dur_min\":"));
  Serial.print(dataSistem.durasiMenit, 1);
  Serial.print(F(",\"shed\":"));
  Serial.print(dataSistem.modeShedding ? 1 : 0);
  Serial.println(F("}"));
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY_POMPA, OUTPUT);
  pinMode(RELAY_CHILLER, OUTPUT);
  pinMode(RELAY_LAMPU, OUTPUT);
  pinMode(RELAY_KIPAS, OUTPUT);

  digitalWrite(RELAY_POMPA, RELAY_ON);
  digitalWrite(RELAY_CHILLER, RELAY_ON);
  digitalWrite(RELAY_LAMPU, RELAY_ON);
  digitalWrite(RELAY_KIPAS, RELAY_ON);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
}

void loop() {
  unsigned long waktuSekarang = millis();
  if (waktuSekarang - waktuSebelumnya >= INTERVAL_UPDATE_MS) {
    waktuSebelumnya = waktuSekarang;
    prosesManajemenEnergi();
    kirimDataTelemetri();
  }
}
