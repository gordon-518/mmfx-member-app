// ============================================================================
// One-time Softr → Supabase user migration
// 107 Mentorship users, deduplicated from the Softr CSV export (2026-06-19)
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate-softr-users.mjs
//
// Get the service_role key from:
//   Supabase Dashboard → Project → Settings → API → service_role (secret key)
//
// This script NEVER sends a confirmation/magic-link email — users are
// created with email_confirm: true (confirmed but no password).
// They sign in via magic link exactly as normal members do.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dldrcitoeoxzfctsqlmo.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required.')
  console.error('  Get it from: Supabase Dashboard → Settings → API → service_role')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Deduped Mentorship users from Softr CSV ───────────────────────────────
// Duplicates removed (kept first occurrence). Skipped: gordon@, hello@, empty row.
const USERS = [
  { email: 'kevvin.dupoin@gmail.com',                   name: 'Kevvin Dupoin' },
  { email: 'edmundkbl@gmail.com',                       name: 'Edmund Dupoin' },
  { email: 'hojiza22@gmail.com',                        name: 'ZAYNABUTDINOV HOJIAKBAR' },
  { email: 'sh.khalid.k.s@gmail.com',                   name: 'Shaikh khaled khalifa al nahyan' },
  { email: 'olaf.dollak@gmail.com',                     name: 'Olaf Jan Dollak' },
  { email: 'eseluportfolio@gmail.com',                  name: 'Ikenna Kingsley Nwachukwu' },
  { email: 'mark.teowl@gmail.com',                      name: 'Mark Teo Wei Lun' },
  { email: 'enqz.88@hotmail.com',                       name: 'Eugene Ng Qin Zhi' },
  { email: 'aleemwp@gmail.com',                         name: 'Aleem Asghar' },
  { email: 'mahdi777@naver.com',                        name: 'PARK YOUNG CHAN' },
  { email: 'timothykeishen@gmail.com',                  name: 'Timothy Keishen Raj' },
  { email: 'irenetanls@gmail.com',                      name: 'Tan Lay San' },
  { email: 'lohyikuan1111@gmail.com',                   name: 'Loh Yi Kuan' },
  { email: 'shahrizal2007@gmail.com',                   name: 'Mohd Shahrizal Md Nawawi' },
  { email: 'jaewyho@gmail.com',                         name: 'HO WEI YING' },
  { email: 'vinnehfied@gmail.com',                      name: 'Tay Yan Chiang, Vincent' },
  { email: 'yongkathie@gmail.com',                      name: 'Yong Siew Woon' },
  { email: 'petrus.lioe17@gmail.com',                   name: 'Petrus' },
  { email: 'kb1811@gmail.com',                          name: 'Low Kok Bo (Kenny)' },
  { email: 'arinnjayk@gmail.com',                       name: 'Arinn Jaay Kannan R' },
  { email: 'glenn@gdldampproofing.com.au',              name: 'Glenn Lambert' },
  { email: 'xianaun@hotmail.com',                       name: 'Lim Xian Aun' },
  { email: 'ravi20gk@gmail.com',                        name: 'Ravikumar gk' },
  { email: 'curiousg1609@gmail.com',                    name: 'Tong Tsz Ching' },
  { email: 'doziem4@gmail.com',                         name: 'Chiedozie Tobias' },
  { email: 'mr.yussuf.fx@gmail.com',                    name: 'Mr.YUSSUF.XAU' },
  { email: 'shaheedys@gmail.com',                       name: 'Abdul Shaheed bin Yusoff' },
  { email: 'mpefconta@gmail.com',                       name: 'MARCILIO JOAQUIM DE OLIVEIRA' },
  { email: 'talib.k1984@gmail.com',                     name: 'Talib koc' },
  { email: 'kwinadu@gmail.com',                         name: 'Queen Adu' },
  { email: 'happylibra4@gmail.com',                     name: '李慶煌' },
  { email: 'joycegay79@gmail.com',                      name: 'Joyce gay' },
  { email: 'idaariyo@gmail.com',                        name: 'Ariyo Adeyemi IDowu' },
  { email: 'aaronlim6@gmail.com',                       name: 'Aaron Lim' },
  { email: 'forexchristine@gmail.com',                  name: 'christine hans' },
  { email: 'subaybeh@yahoo.com.sg',                     name: 'Suriati Binti Kamarudin' },
  { email: 'stanleychangyuu@gmail.com',                 name: 'Stanley Chang Yu' },
  { email: 'zmxmeng@gmail.com',                         name: 'CHANG MENG HENG' },
  { email: 'garymyang@gmail.com',                       name: 'Yang Jiawen Gary Martin' },
  { email: 'gkalimukwasilwalo@gmail.com',               name: 'Kalimukwa Silwalo' },
  { email: 'rmcm.moser@gmail.com',                      name: 'Ralph Moser' },
  { email: 'stevenadeputra@gmail.com',                  name: 'Ade Putra T. Stevent' },
  { email: 'bc.fu@hotmail.com',                         name: 'Mike Fu' },
  { email: 'bosesqldeveloper@gmail.com',                name: 'Felicia Boss Lady' },
  { email: 'nihaama1511@gmail.com',                     name: 'Nihaama Narayanan' },
  { email: 'brian.s.anan@gmail.com',                    name: 'S AANANTHON' },
  { email: 'sibunge@gmail.com',                         name: 'SANTIAGO IGNACIO BUNGE' },
  { email: 'olatunbosunowoeye.emmanuel@gmail.com',      name: 'Olatunbosun Emmanuel Owoeye' },
  { email: 'nadine@alloytrading.co.za',                 name: 'Nadine' },
  { email: 'ktkpbsr@gmail.com',                         name: 'Shahi Kulvinder' },
  { email: 'enockwilson6@gmail.com',                    name: 'Enock Wilson Essuman' },
  { email: 'mdanishrafiqca@gmail.com',                  name: 'Muhammad Danish Rafiq' },
  { email: 'akilan_star@hotmail.com',                   name: 'K Akilan' },
  { email: 'valuescrest@gmail.com',                     name: 'PETER NOAH ORUIGONI' },
  { email: 'ali.abbas243@gmail.com',                    name: 'Ali Abbas' },
  { email: 'aggarwalgaurav353@gmail.com',               name: 'Gaurav Agarwal' },
  { email: 'ahmad95ismail66@gmail.com',                 name: 'Ahmad bin Ismail' },
  { email: 'jason.ow@gmail.com',                        name: 'OW LI SHENG' },
  { email: 'nitin.nair1027@outlook.com',                name: 'Nitin KARUNAKARAN' },
  { email: 'blessingeghogho@gmail.com',                 name: 'BLESSING EGHOGHO AIKHOMU' },
  { email: 'stijnvanoorschot1984@gmail.com',            name: 'Stijn van Oorschot' },
  { email: 'johneb91@gmail.com',                        name: 'John Nwonye' },
  { email: 'adheebmuhammad@gmail.com',                  name: 'Muhammad Adheeb' },
  { email: 'mwandrew69@gmail.com',                      name: 'ANDREW MWANGI NJOROGE' },
  { email: 'okekechibuike84@yahoo.com',                 name: 'Kingsley chibuike' },
  { email: 'mborja84@gmail.com',                        name: 'MARCO PAULO BORJA' },
  { email: 'jamshys@gmail.com',                         name: 'Jamsheed Kattayadan' },
  { email: 'suryaasizzelz@gmail.com',                   name: 'Suriya Karthikeyan' },
  { email: 'lotannachukwuemeka@yahoo.com',              name: 'Nnabuike lotanna Chukwuemeka' },
  { email: 'daniel.enev67@gmail.com',                   name: 'Daniel Enev Dimitrov' },
  { email: 'garypang_2000@yahoo.com',                   name: 'Pang Ching han' },
  { email: 'ephrem.r.leon@gmail.com',                   name: 'Ephrem R Leon' },
  { email: 'vik.kirsanov@gmail.com',                    name: 'Viktor Kirsanov' },
  { email: 'remigijus.treneris@gmail.com',              name: 'Remigijus' },
  { email: 'zamisl18@gmail.com',                        name: 'Hairizam Bin Islakhuddin' },
  { email: 'shehugusman@gmail.com',                     name: 'Shehu Usman Gambo' },
  { email: 'kvst120@gmail.com',                         name: 'Kirtivardhan Thakur' },
  { email: 'dr.sahil.com@gmail.com',                    name: 'Mahbbob khurram' },
  { email: 'ericlauyh@gmail.com',                       name: 'Lau Yeow Hui' },
  { email: 'n.leanghorn@gmail.com',                     name: 'Nguon Leanghorn' },
  { email: 'focuscal@hotmail.com',                      name: 'Calvin Siow Kah Weng' },
  { email: 'cve.2022@gmail.com',                        name: 'SALEM AHMAD KHAMEES ELHAJ' },
  { email: 'harshvrits34@gmail.com',                    name: 'Harsh sisodiya' },
  { email: 'ongbrayan123@gmail.com',                    name: 'Ong Chong Haan' },
  { email: 'rory@rapidtrade.biz',                       name: 'Rory Donovan Enslin' },
  { email: 'khanhuthuy.dsrk82@hotmail.com',             name: 'Kha Nhu Thuy' },
  { email: 'grahamespag85@gmail.com',                   name: 'Graham Espag' },
  { email: 'allforme101@hotmail.com',                   name: 'Rodney Harry' },
  { email: 'm.ostin002@gmail.com',                      name: 'Ostin Mariyanayagam' },
  { email: 'wbredenhann@hotmail.com',                   name: 'Wehandre Bredenhann' },
  { email: 'dariusni001@gmail.com',                     name: 'Darius Ni' },
  { email: 'ernestosose@gmail.com',                     name: 'Ernest Osose' },
  { email: 'alimohamedzx@proton.me',                    name: 'Mohamed Ali T' },
  { email: 'ap143076@gmail.com',                        name: 'Aditya prakash' },
  { email: 'wrightbruce04@gmail.com',                   name: 'Bruce Wayne Wright' },
  { email: 'zzhanghoon@icloud.com',                     name: '황창훈' },
  { email: 'raazgupta8744@gmail.com',                   name: 'Raaz Gupta' },
  { email: 'hassanmostafakamal1962@gmail.com',          name: 'Hassan Mostafa Kamal Mohamed' },
  { email: 'waleedtufail@gmail.com',                    name: 'Waleed Bin Tufail' },
  { email: 'mohit9595021538@gmail.com',                 name: 'Mohit Ranshoor' },
  { email: 'venkateswarar511@gmail.com',                name: 'Suraparaju venkateswara raju' },
  { email: 'cyhj1331331@gmail.com',                     name: 'Chan Yi Hong' },
  { email: 'oreoforthewin@gmail.com',                   name: 'hafzan' },
  { email: 'mdeepakdxb@gmail.com',                      name: 'Mohan Deepak' },
  { email: 'aqilaminuddin@gmail.com',                   name: 'Nik Aqil Bin Nik Aminuddin' },
  { email: 'akaypopsy1960@gmail.com',                   name: 'Akinola Rasheed POPOOLA' },
  { email: 'evelyn.gwj@gmail.com',                      name: 'Gan wan jun' },
]

async function main() {
  console.log(`Migrating ${USERS.length} Softr members to Supabase...\n`)

  // Pre-fetch existing auth users so we don't hit "already registered" errors
  let existingByEmail = {}
  const { data: existing, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) {
    console.warn('Warning: could not pre-fetch existing users:', listErr.message)
  } else {
    for (const u of existing.users) {
      if (u.email) existingByEmail[u.email.toLowerCase()] = u.id
    }
    console.log(`${Object.keys(existingByEmail).length} existing auth users found\n`)
  }

  let created = 0, updated = 0, skipped = 0, errors = 0
  const failed = []

  for (const { email, name } of USERS) {
    const key = email.toLowerCase()
    let userId = existingByEmail[key]

    if (userId) {
      // User already exists in auth — just update their profile below
      process.stdout.write(`EXIST  ${email}\n`)
      skipped++
    } else {
      // Create new confirmed user — no confirmation email, no password
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name },
      })

      if (error) {
        console.error(`ERR    ${email}: ${error.message}`)
        errors++
        failed.push({ email, reason: error.message })
        continue
      }

      userId = data.user.id
      created++
      process.stdout.write(`NEW    ${email}\n`)
    }

    // Flip to member_active — trigger already created the profile row
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ account_status: 'member_active', member_status: 'active', full_name: name })
      .eq('id', userId)

    if (profErr) {
      console.error(`PROF   ${email}: ${profErr.message}`)
      errors++
      failed.push({ email, reason: `profile update: ${profErr.message}` })
    } else {
      updated++
    }

    // 150 ms throttle — Supabase admin API rate limit is generous but be safe
    await new Promise(r => setTimeout(r, 150))
  }

  console.log('\n─────────────────────────────────────')
  console.log(`Created:  ${created}`)
  console.log(`Existing: ${skipped}`)
  console.log(`Profiles: ${updated} updated to member_active`)
  console.log(`Errors:   ${errors}`)

  if (failed.length) {
    console.log('\nFailed rows:')
    failed.forEach(f => console.log(`  ${f.email} — ${f.reason}`))
  }

  if (errors === 0) {
    console.log('\n✅ Migration complete — all users are member_active')
  } else {
    console.log('\n⚠️  Migration finished with errors — review failed rows above')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
