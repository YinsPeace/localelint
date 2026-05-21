import SwiftUI

struct ContentView: View {
    let userName: String = "Yin"
    let bookTitle: String = "The Pragmatic Programmer"
    let friendName: String = "Mira"
    let noteCount: Int = 3

    var body: some View {
        VStack(spacing: 16) {
            Text("welcome.title", comment: "Title shown on app launch screen")
                .font(.largeTitle)

            Text("user.greeting \(userName)", comment: "Personalized greeting. %@ is the user's first name.")
                .font(.title2)

            Text("notes.count \(noteCount)", comment: "Count of notes in user's library. %lld is the count.")

            Text("action.new.note", comment: "Button to add a new book to library")
                .padding(.top)

            Text("share.with.friends \(bookTitle) \(friendName)", comment: "Share a book recommendation. %1$@ is the book title, %2$@ is the friend's name.")
                .font(.footnote)

            Text("settings.title")
                .font(.headline)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
