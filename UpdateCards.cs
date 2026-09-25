using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

class Program {
    static void Main() {
        string dir = @"C:\Users\LENOVO\.gemini\antigravity\scratch\hospital-wastewater-50th-spa\js\modules";
        var files = Directory.GetFiles(dir, "*.js");
        
        foreach (var file in files) {
            string filename = Path.GetFileName(file);
            string content = File.ReadAllText(file, Encoding.UTF8);
            
            var matches = Regex.Matches(content, @"const\s+summaryCards\s*=\s*\[.*?\];", RegexOptions.Singleline);
            
            if (matches.Count >= 2) {
                var matchToReplace = matches[1];
                string replacement = GetReplacementCards(filename);
                if (replacement != null) {
                    content = content.Remove(matchToReplace.Index, matchToReplace.Length).Insert(matchToReplace.Index, replacement);
                    File.WriteAllText(file, content, new UTF8Encoding(true));
                    Console.WriteLine("Updated " + filename);
                } else {
                    Console.WriteLine("No replacement defined for " + filename);
                }
            } else {
                Console.WriteLine("Could not find 2 summaryCards in " + filename);
            }
        }
    }

    static string GetReplacementCards(string filename) {
        if (filename == "influent.js") {
            return @"const summaryCards = [
            {
                title: 'จำนวนรายการทั้งหมด',
                value: `${totalItems.toLocaleString()} รายการ`,
                subText: 'ตามเงื่อนไข',
                icon: 'fa-solid fa-list-check',
                color: 'cyan'
            },
            {
                title: 'ปริมาณน้ำรวม (TOTAL FLOW)',
                value: `${totalWater.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ลบ.ม.`,
                subText: 'น้ำประปา+น้ำเสีย 80%',
                icon: 'fa-solid fa-faucet-drip',
                color: 'blue'
            },
            {
                title: 'ปริมาณน้ำเสีย 80% สุทธิ',
                value: `${totalWastewater.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ลบ.ม.`,
                subText: 'คงเหลือ = น้ำเสีย - บำบัด',
                icon: 'fa-solid fa-water',
                color: 'emerald'
            },
            {
                title: 'มูลค่าน้ำประปารวม (TOTAL VALUE)',
                value: `฿${(totalWater * 25).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
                subText: 'ค่าน้ำประปาทั้งหมด',
                icon: 'fa-solid fa-coins',
                color: 'amber'
            }
        ];";
        }
        else if (filename == "electricity.js") {
            return @"const summaryCards = [
            {
                title: 'จำนวนรายการ',
                value: `${totalItems.toLocaleString()} รายการ`,
                subText: 'ตามเงื่อนไข',
                icon: 'fa-solid fa-list-check',
                color: 'cyan'
            },
            {
                title: 'หน่วยไฟฟ้ารวม (TOTAL kWh)',
                value: `${totalKwh.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`,
                subText: 'ผลรวมหน่วยไฟฟ้าทั้งหมด',
                icon: 'fa-solid fa-bolt',
                color: 'amber'
            },
            {
                title: 'ค่าไฟฟ้ารวม (TOTAL COST)',
                value: `฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
                subText: 'ค่าไฟฟ้ารวมทั้งหมด',
                icon: 'fa-solid fa-coins',
                color: 'emerald'
            },
            {
                title: 'อัตราค่าไฟฟ้าเฉลี่ย (AVG RATE)',
                value: `${totalKwh > 0 ? (totalCost/totalKwh).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} บาท/kWh`,
                subText: 'เฉลี่ยต่อหน่วย',
                icon: 'fa-solid fa-chart-line',
                color: 'purple'
            }
        ];";
        }
        else if (filename == "equipment-ref.js") {
            return @"const summaryCards = [
            {
                title: 'รายการสินค้าในสต็อก',
                value: `${totalItems.toLocaleString()} รายการ`,
                subText: 'ตามเงื่อนไข',
                icon: 'fa-solid fa-boxes-stacked',
                color: 'cyan'
            },
            {
                title: 'รับเข้ารวม (+) VS รายออก (-)',
                value: `+0 / -0`,
                subText: 'ประมวลผลทั้งหมด transactions',
                icon: 'fa-solid fa-arrow-right-arrow-left',
                color: 'blue'
            },
            {
                title: 'ปริมาณคงเหลือสุทธิ',
                value: `${totalItems.toLocaleString()} หน่วย`,
                subText: 'คงสต็อก = รับเข้า - จ่ายออก',
                icon: 'fa-solid fa-box-open',
                color: 'emerald'
            },
            {
                title: 'มูลค่าคงคลังรวม (TOTAL VALUE)',
                value: `฿0.00 บาท`,
                subText: 'ค่าสินทรัพย์ทั้งหมด',
                icon: 'fa-solid fa-coins',
                color: 'amber'
            }
        ];";
        }
        else if (filename == "maintenance.js") {
            return @"const summaryCards = [
            {
                title: 'จำนวนรายการ',
                value: `${totalItems.toLocaleString()} รายการ`,
                subText: 'ตามเงื่อนไข',
                icon: 'fa-solid fa-screwdriver-wrench',
                color: 'cyan'
            },
            {
                title: 'ค่าซ่อมรวม (TOTAL COST)',
                value: `฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
                subText: 'ค่าซ่อมบำรุงทั้งหมด',
                icon: 'fa-solid fa-coins',
                color: 'emerald'
            },
            {
                title: 'งาน PM vs แก้ไข (PM RATIO)',
                value: `PM: ${pmCount || 0} | แก้ไข: ${correctiveCount || 0}`,
                subText: 'สัดส่วนงานซ่อม',
                icon: 'fa-solid fa-chart-pie',
                color: 'amber'
            },
            {
                title: 'อัตราแล้วเสร็จ (COMPLETION)',
                value: `100.0%`,
                subText: `เสร็จ ${totalItems} จาก ${totalItems} รายการ`,
                icon: 'fa-solid fa-check-double',
                color: 'blue'
            }
        ];";
        }

        return null;
    }
}
