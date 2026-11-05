package com.errandom.qmt;

import java.util.*;

public final class PolicyTest {
    private static int checks;
    private static void check(boolean condition) { checks++; if (!condition) throw new AssertionError("Check " + checks); }
    public static void main(String[] args) {
        check(Policy.trusted("https://qmt.errandom.com/path?q=1"));
        check(Policy.trusted("https://qmt.errandom.com:443/"));
        for (String bad : new String[]{"http://qmt.errandom.com", "https://qmt.errandom.com.evil.example",
            "https://qmt.errandom.com@evil.example", "https://user@qmt.errandom.com", "https://qmt.errandom.com:444",
            "javascript:alert(1)", "file:///private", "https://qmt.errandom.com\\@evil.example"})
            check(!Policy.trusted(bad));
        Map<String,String> before = new HashMap<>(), after = new HashMap<>();
        Map<String,Long> ends = new HashMap<>(), starts = new HashMap<>();
        before.put("1","old"); after.put("1","old"); ends.put("1",200L); starts.put("1",100L);
        check(!Policy.scheduleChanged(null, after, ends, starts, 100, 300));
        check(!Policy.scheduleChanged(before, after, ends, starts, 100, 300));
        after.put("1","changed"); check(Policy.scheduleChanged(before, after, ends, starts, 100, 300));
        after.clear(); check(Policy.scheduleChanged(before, after, ends, starts, 100, 300));
        check(!Policy.scheduleChanged(before, after, ends, starts, 201, 300));
        before.clear(); after.put("2","new"); starts.put("2",150L);
        check(Policy.scheduleChanged(before, after, ends, starts, 100, 300));
        starts.put("2",300L); check(!Policy.scheduleChanged(before, after, ends, starts, 100, 300));
        check(Policy.hash("abc").equals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
        System.out.println("PASS: " + checks + " policy checks");
    }
}
