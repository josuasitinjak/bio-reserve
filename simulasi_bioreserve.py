import math

K_FACTOR = 0.6544
KAPASITAS_TANGKI = 100.0
ENERGI_MAKS = KAPASITAS_TANGKI * K_FACTOR

DAYA_POMPA = 60.0
DAYA_PENDINGIN = 40.0
DAYA_LAMPU = 300.0
DAYA_KIPAS = 300.0

DAYA_KRITIS = DAYA_POMPA + DAYA_PENDINGIN
DAYA_NONKRITIS = DAYA_LAMPU + DAYA_KIPAS
DAYA_TOTAL = DAYA_KRITIS + DAYA_NONKRITIS

SOC_THRESHOLD = 25.0
DT_MENIT = 0.05

def jalankan_simulasi(dengan_shedding=True, gas_awal_liter=100.0):
    waktu = [0.0]
    gas_tersisa = [gas_awal_liter]
    soc_list = [(gas_awal_liter / KAPASITAS_TANGKI) * 100.0]
    energi_list = [gas_awal_liter * K_FACTOR]
    daya_list = [DAYA_TOTAL]
    mode_shedding_list = [False]

    cur_gas = gas_awal_liter
    t = 0.0

    while cur_gas > 0.001:
        cur_soc = (cur_gas / KAPASITAS_TANGKI) * 100.0

        if dengan_shedding:
            if cur_soc <= SOC_THRESHOLD:
                daya_aktif = DAYA_KRITIS
                is_shedding = True
            else:
                daya_aktif = DAYA_TOTAL
                is_shedding = False
        else:
            daya_aktif = DAYA_TOTAL
            is_shedding = False

        konsumsi_liter = (daya_aktif * (DT_MENIT / 60.0)) / K_FACTOR
        cur_gas = max(0.0, cur_gas - konsumsi_liter)
        t += DT_MENIT

        waktu.append(t)
        gas_tersisa.append(cur_gas)
        soc_list.append((cur_gas / KAPASITAS_TANGKI) * 100.0)
        energi_list.append(cur_gas * K_FACTOR)
        daya_list.append(daya_aktif)
        mode_shedding_list.append(is_shedding)

    return {
        'waktu': waktu,
        'gas': gas_tersisa,
        'soc': soc_list,
        'energi': energi_list,
        'daya': daya_list,
        'shedding': mode_shedding_list
    }

res_baseline = jalankan_simulasi(dengan_shedding=False, gas_awal_liter=100.0)
res_bioreserve = jalankan_simulasi(dengan_shedding=True, gas_awal_liter=100.0)
res_kritis_bioreserve = jalankan_simulasi(dengan_shedding=True, gas_awal_liter=24.7)
res_kritis_baseline = jalankan_simulasi(dengan_shedding=False, gas_awal_liter=24.7)

print("HASIL SIMULASI BIO-RESERVE")
print(f"Tangki: {KAPASITAS_TANGKI} L ({ENERGI_MAKS:.2f} Wh)")
print(f"Beban Kritis: {DAYA_KRITIS} W | Beban Nonkritis: {DAYA_NONKRITIS} W")
print(f"Baseline (700W konstan): {res_baseline['waktu'][-1]:.2f} menit")
print(f"BIO-RESERVE: {res_bioreserve['waktu'][-1]:.2f} menit")
print(f"Skenario Ambang Kritis 24.7% (Tanpa Kontrol): {res_kritis_baseline['waktu'][-1]:.2f} menit")
print(f"Skenario Ambang Kritis 24.7% (BIO-RESERVE)   : {res_kritis_bioreserve['waktu'][-1]:.2f} menit")
print(f"Rasio Durasi: {res_kritis_bioreserve['waktu'][-1] / res_kritis_baseline['waktu'][-1]:.2f}x lipat")

print("\nWaktu(mnt) | Gas(L) | Tekanan(kPa) | SOC(%) | Daya(W) | Status Relai")
sample_times = [0, 2, 4, 5.5, 6, 7, 10, 13.8]
for target_t in sample_times:
    idx = min(range(len(res_bioreserve['waktu'])), key=lambda i: abs(res_bioreserve['waktu'][i] - target_t))
    t = res_bioreserve['waktu'][idx]
    g = res_bioreserve['gas'][idx]
    p = (g / KAPASITAS_TANGKI) * 10.0
    soc = res_bioreserve['soc'][idx]
    w = res_bioreserve['daya'][idx]
    status = "SHEDDING" if res_bioreserve['shedding'][idx] else "NORMAL"
    print(f"{t:10.2f} | {g:6.2f} | {p:12.2f} | {soc:6.1f} | {w:7.0f} | {status}")
