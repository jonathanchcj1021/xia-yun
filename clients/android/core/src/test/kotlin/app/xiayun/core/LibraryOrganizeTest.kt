package app.xiayun.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.text.Collator
import java.util.Locale

class LibraryOrganizeTest {
    @Test
    fun shareNoteKeepsUrlOnlyAsLinkAndOtherTextAsFirstLine() {
        val link = shareNote("https://example.com/a", "連結", "分享")
        assertEquals("連結", link?.title)
        assertEquals("https://example.com/a", link?.body)
        val mixed = shareNote("看這個\nhttps://example.com/a", "連結", "分享")
        assertEquals("看這個", mixed?.title)
        assertEquals("看這個\nhttps://example.com/a", mixed?.body)
        assertNull(shareNote("   ", "連結", "分享"))
        val fromSubject = assembleShareText(null, "貼文標題", null, null)
        assertEquals("貼文標題", fromSubject)
        val urlAndSubject = assembleShareText("https://example.com/a", "貼文標題", null, null)
        assertEquals("貼文標題\nhttps://example.com/a", urlAndSubject)
        val clipOnly = assembleShareText("  ", null, "來自剪貼簿", "<p>html</p>")
        assertEquals("來自剪貼簿", clipOnly)
        val htmlOnly = assembleShareText(null, null, null, "<p>html</p>")
        assertEquals("<p>html</p>", htmlOnly)
        assertNull(assembleShareText("  ", " ", null, null))
        assertEquals(null, canonicalGroup(" 未分組 "))
        assertEquals("旅行", canonicalGroup(" 旅行 "))
    }

    @Test
    fun groupsSortWithUngroupedLast() {
        val organized = organizeLibrary(sample(), "", LibraryTypeFilter.All, LibrarySort.Newest, null)
        assertFalse(organized.filtering)
        assertEquals(UNGROUPED_LABEL, organized.shelves.last().name)
        assertEquals(listOf("lease", "reading", "ficus"), organized.shelves.last().items.map { it.id })
        val named = organized.shelves.dropLast(1).map { it.name }
        val expected = named.sortedWith(Collator.getInstance(Locale.TAIWAN))
        assertEquals(expected, named)
        assertEquals(3, organized.shelves.last().items.size)
    }

    @Test
    fun searchTypeAndTagCombineAndIgnoreTagText() {
        val hit = organizeLibrary(sample(), "清水", LibraryTypeFilter.Text, LibrarySort.Newest, "旅行")
        assertEquals(listOf("itinerary"), hit.visible.map { it.id })
        assertTrue(hit.filtering)
        assertTrue(hit.shelves.filter { it.items.isEmpty() }.isNotEmpty())

        val body = organizeLibrary(sample(), "南禪寺", LibraryTypeFilter.All, LibrarySort.Newest, null)
        assertEquals(listOf("itinerary"), body.visible.map { it.id })

        val tagWord = organizeLibrary(sample(), "稅務", LibraryTypeFilter.All, LibrarySort.Newest, null)
        assertTrue(tagWord.visible.isEmpty())

        val files = organizeLibrary(sample(), "", LibraryTypeFilter.File, LibrarySort.Name, null)
        assertEquals(listOf("fee", "lease", "tax"), files.visible.map { it.id }.sorted())
        assertTrue(files.visible.none { it.type == "image" || it.type == "text" })
    }

    @Test
    fun oldestAndNameSortStayInsideTheRequest() {
        val oldest = organizeLibrary(sample(), "", LibraryTypeFilter.All, LibrarySort.Oldest, null)
        val kyoto = oldest.shelves.first { it.name == "京都行" }.items.map { it.id }
        assertEquals(listOf("itinerary", "kiyomizu", "pontocho"), kyoto)

        val byName = organizeLibrary(sample(), "", LibraryTypeFilter.Image, LibrarySort.Name, null).visible.map { it.name }
        assertEquals(byName.sortedWith(Collator.getInstance(Locale.TAIWAN)), byName)
        assertEquals(3, byName.size)
    }

    @Test
    fun blankGroupIsUngroupedAndTagsNormalize() {
        assertNull(canonicalGroup(null))
        assertNull(canonicalGroup("  "))
        assertNull(canonicalGroup("未分組"))
        assertEquals("京都 行", canonicalGroup("  京都  行 "))
        assertEquals("待寄", normalizeTag("  待寄  "))
        assertEquals("", normalizeTag("   "))
    }

    private fun sample(): List<CloudItem> = listOf(
        item("kiyomizu", "image", "清水寺參道.jpg", "京都行", listOf("旅行", "京都"), "2026-03-18T01:40:00Z"),
        item("pontocho", "image", "先斗町夜雨.jpg", "京都行", listOf("旅行", "京都", "夜"), "2026-03-18T12:15:00Z"),
        item(
            "itinerary",
            "text",
            "三日行程",
            "京都行",
            listOf("旅行", "行程"),
            "2026-03-17T13:05:00Z",
            excerpt = "三月十八日，從京都車站走去清水寺，參道上的人比想像中少。",
            body = "下午在二年坂。晚上到先斗町。十九日想去南禪寺水路閣。",
        ),
        item("tax", "file", "綜合所得稅申報書-民國114年.pdf", "家裡的紙", listOf("稅務", "重要"), "2026-05-11T03:20:00Z"),
        item("fee", "file", "大安公寓管理費-三月.pdf", "家裡的紙", listOf("家計"), "2026-04-03T00:12:00Z"),
        item("miso", "text", "味噌湯的比例", "  家裡的紙  ", listOf("食譜"), "2026-01-09T11:30:00Z", excerpt = "昆布 10 公克"),
        item("ficus", "image", "窗邊的琴葉榕.jpg", "", listOf("家"), "2026-08-21T08:04:00Z"),
        item("reading", "text", "想讀的書", "未分組", emptyList(), "2026-09-14T14:18:00Z", excerpt = "陳冠學《田園之秋》"),
        item("lease", "file", "房東續約草案.docx", null, listOf("重要"), "2026-09-20T05:45:00Z"),
    )

    private fun item(
        id: String,
        type: String,
        name: String,
        group: String?,
        tags: List<String>,
        createdAt: String,
        excerpt: String? = null,
        body: String? = null,
    ) = CloudItem(
        id = id,
        type = type,
        name = name,
        createdAt = createdAt,
        group = group,
        tags = tags,
        excerpt = excerpt,
        body = body,
    )
}
